import { HYPE_SEND_ASSET_TOKEN_MAP } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  fetchClearinghouseStateHttp,
  fetchSpotStateHttp,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { isSamePerpsFundingAccount } from './accountGuard';
import { signPerpsMasterTypedData } from './signPerpsMasterTypedData';

export interface PerpsSpotToPerpsTransferCommand {
  account: Account;
  amount: string;
  destinationDex: '';
  expectedAvailable: string;
  sourceDex: 'spot';
  token: typeof HYPE_SEND_ASSET_TOKEN_MAP.USDC;
  type: 'spotToPerpsTransfer';
}

export interface PerpsSpotToPerpsTransferResult {
  error?: string;
  failureReason?: 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'staleContext' | 'success';
  refreshError?: string;
}

interface PreparedSendAsset extends Record<string, any> {
  message: unknown;
  nonce?: number;
}

export interface PerpsSpotToPerpsTransferDependencies {
  getCurrentAccount: () => Account | null;
  getSpotUsdcAvailable: () => string;
  getUserAbstraction: () => unknown;
  prepareSendAsset: (params: {
    amount: string;
    destination: string;
    destinationDex: '';
    sourceDex: 'spot';
    token: typeof HYPE_SEND_ASSET_TOKEN_MAP.USDC;
  }) => PreparedSendAsset;
  refreshPerps: (expectedAddress: string) => Promise<unknown> | unknown;
  refreshSpot: (expectedAddress: string) => Promise<unknown> | unknown;
  sendSendAsset: (params: {
    action: unknown;
    nonce: number;
    signature: string;
  }) => Promise<unknown>;
  sign: (action: PreparedSendAsset, account: Account) => Promise<string>;
}

const decimal = (value: unknown) => {
  const result = new BigNumber((value as string | number | undefined) ?? NaN);
  return result.isFinite() ? result : null;
};

const isStandardAccount = (value: unknown) =>
  value === UserAbstractionResp.default || value === 'default';

export const buildPerpsSpotToPerpsTransferCommand = ({
  account,
  amount,
  available,
}: {
  account: Account;
  amount: string;
  available: string;
}): PerpsSpotToPerpsTransferCommand => {
  const normalizedAmount = decimal(amount);
  const normalizedAvailable = decimal(available);
  if (
    !account.address ||
    !normalizedAmount ||
    normalizedAmount.lte(0) ||
    !normalizedAvailable ||
    normalizedAvailable.lt(0) ||
    normalizedAmount.gt(normalizedAvailable)
  ) {
    throw new Error('Invalid Spot USDC transfer amount');
  }

  return Object.freeze({
    account: Object.freeze({ ...account }),
    amount: normalizedAmount.toFixed(),
    destinationDex: '' as const,
    expectedAvailable: normalizedAvailable.toFixed(),
    sourceDex: 'spot' as const,
    token: HYPE_SEND_ASSET_TOKEN_MAP.USDC,
    type: 'spotToPerpsTransfer' as const,
  });
};

const hasLiveTransferContext = (
  command: PerpsSpotToPerpsTransferCommand,
  dependencies: PerpsSpotToPerpsTransferDependencies,
) => {
  if (
    !isSamePerpsFundingAccount(
      dependencies.getCurrentAccount(),
      command.account,
    ) ||
    !isStandardAccount(dependencies.getUserAbstraction())
  ) {
    return false;
  }
  const available = decimal(dependencies.getSpotUsdcAvailable());
  return !!available && available.gte(command.amount);
};

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  return exchange;
};

const defaultDependencies: PerpsSpotToPerpsTransferDependencies = {
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getSpotUsdcAvailable: () =>
    perpsStore.getState().spotState.rawBalancesByToken[0]?.available || '0',
  getUserAbstraction: () => perpsStore.getState().userAbstraction,
  prepareSendAsset: params => getExchange().prepareSendAsset(params),
  refreshPerps: expectedAddress =>
    fetchClearinghouseStateHttp('', expectedAddress),
  refreshSpot: expectedAddress => fetchSpotStateHttp(expectedAddress),
  sendSendAsset: params =>
    getExchange().sendSendAsset({
      action: params.action as any,
      nonce: params.nonce,
      signature: params.signature,
    }),
  sign: (action, account) =>
    signPerpsMasterTypedData({
      account,
      action,
    }),
};

export const executePerpsSpotToPerpsTransfer = async (
  command: PerpsSpotToPerpsTransferCommand,
  dependencies: PerpsSpotToPerpsTransferDependencies = defaultDependencies,
): Promise<PerpsSpotToPerpsTransferResult> => {
  if (!hasLiveTransferContext(command, dependencies)) {
    return { kind: 'staleContext' };
  }

  try {
    const action = dependencies.prepareSendAsset({
      amount: command.amount,
      destination: command.account.address,
      destinationDex: command.destinationDex,
      sourceDex: command.sourceDex,
      token: command.token,
    });
    const signature = await dependencies.sign(action, command.account);
    if (!hasLiveTransferContext(command, dependencies)) {
      return { kind: 'staleContext' };
    }
    const response = await dependencies.sendSendAsset({
      action: action.message,
      nonce: action.nonce || 0,
      signature,
    });
    if ((response as { status?: unknown })?.status !== 'ok') {
      throw new Error('Hyperliquid rejected Spot USDC transfer');
    }

    let refreshError: string | undefined;
    try {
      await Promise.all([
        dependencies.refreshSpot(command.account.address),
        dependencies.refreshPerps(command.account.address),
      ]);
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
    return { kind: 'success', refreshError };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      failureReason: isPerpsActionUserCancelled(error)
        ? 'userCancelled'
        : 'requestFailed',
      kind: 'failed',
    };
  }
};
