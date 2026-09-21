import { HYPE_SEND_ASSET_TOKEN_MAP } from '@/constant/perps';
import type { Account } from '@/core/startupServices/preference';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import BigNumber from 'bignumber.js';

import { isSamePerpsFundingAccount } from './accountGuard';
import { isPerpsStandardTransferAbstraction } from './transferEligibility';

export interface PerpsSpotToPerpsTransferCommand {
  account: Account;
  accountRuntimeGeneration: number;
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
  getAccountRuntimeGeneration: () => number;
  getCurrentAccount: () => Account | null;
  getRemoteUserAbstraction: (expectedAddress: string) => Promise<unknown>;
  getSpotUsdcAvailable: () => string;
  getUserAbstraction: () => unknown;
  getUserAbstractionReady: () => boolean;
  prepareSendAsset: (params: {
    amount: string;
    destination: string;
    destinationDex: '';
    sourceDex: 'spot';
    token: typeof HYPE_SEND_ASSET_TOKEN_MAP.USDC;
  }) => PreparedSendAsset;
  refreshPerps: (expectedAddress: string) => Promise<unknown> | unknown;
  refreshSpot: (expectedAddress: string) => Promise<unknown> | unknown;
  reconcileRemoteUserAbstraction: (params: {
    account: Account;
    generation: number;
    userAbstraction: unknown;
  }) => void;
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

const PERPS_MASTER_SIGNATURE_PATTERN = /^0x[0-9a-fA-F]{130}$/;

const assertPreparedSendAsset: (
  action: PreparedSendAsset,
) => asserts action is PreparedSendAsset & {
  message: object;
  nonce: number;
} = action => {
  if (
    !action ||
    typeof action.message !== 'object' ||
    action.message === null ||
    !Number.isSafeInteger(action.nonce) ||
    (action.nonce ?? 0) <= 0
  ) {
    throw new Error('Invalid prepared Spot USDC transfer action');
  }
};

const isProviderUserRejected = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    cause?: { code?: unknown };
    code?: unknown;
    data?: { code?: unknown };
  };
  return (
    candidate.code === 4001 ||
    candidate.cause?.code === 4001 ||
    candidate.data?.code === 4001
  );
};

export const buildPerpsSpotToPerpsTransferCommand = ({
  account,
  accountRuntimeGeneration,
  amount,
  available,
}: {
  account: Account;
  accountRuntimeGeneration: number;
  amount: string;
  available: string;
}): PerpsSpotToPerpsTransferCommand => {
  const normalizedAmount = decimal(amount);
  const normalizedAvailable = decimal(available);
  if (
    !account.address ||
    !Number.isSafeInteger(accountRuntimeGeneration) ||
    accountRuntimeGeneration < 0 ||
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
    accountRuntimeGeneration,
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
    dependencies.getAccountRuntimeGeneration() !==
      command.accountRuntimeGeneration ||
    !dependencies.getUserAbstractionReady() ||
    !isPerpsStandardTransferAbstraction(dependencies.getUserAbstraction())
  ) {
    return false;
  }
  const available = decimal(dependencies.getSpotUsdcAvailable());
  return !!available && available.gte(command.amount);
};

const hasRemoteStandardTransferContext = async (
  command: PerpsSpotToPerpsTransferCommand,
  dependencies: PerpsSpotToPerpsTransferDependencies,
) => {
  const remoteUserAbstraction = await dependencies.getRemoteUserAbstraction(
    command.account.address,
  );
  if (!hasLiveTransferContext(command, dependencies)) {
    return false;
  }

  if (remoteUserAbstraction !== dependencies.getUserAbstraction()) {
    dependencies.reconcileRemoteUserAbstraction({
      account: command.account,
      generation: command.accountRuntimeGeneration,
      userAbstraction: remoteUserAbstraction,
    });
  }
  return (
    isPerpsStandardTransferAbstraction(remoteUserAbstraction) &&
    hasLiveTransferContext(command, dependencies)
  );
};

export const executePerpsSpotToPerpsTransferCore = async (
  command: PerpsSpotToPerpsTransferCommand,
  dependencies: PerpsSpotToPerpsTransferDependencies,
): Promise<PerpsSpotToPerpsTransferResult> => {
  if (!hasLiveTransferContext(command, dependencies)) {
    return { kind: 'staleContext' };
  }

  try {
    if (!(await hasRemoteStandardTransferContext(command, dependencies))) {
      return { kind: 'staleContext' };
    }
    const action = dependencies.prepareSendAsset({
      amount: command.amount,
      destination: command.account.address,
      destinationDex: command.destinationDex,
      sourceDex: command.sourceDex,
      token: command.token,
    });
    assertPreparedSendAsset(action);
    const signature = await dependencies.sign(action, command.account);
    if (!hasLiveTransferContext(command, dependencies)) {
      return { kind: 'staleContext' };
    }
    if (!PERPS_MASTER_SIGNATURE_PATTERN.test(signature)) {
      throw new Error('Invalid Spot USDC transfer signature');
    }
    if (!(await hasRemoteStandardTransferContext(command, dependencies))) {
      return { kind: 'staleContext' };
    }
    const response = await dependencies.sendSendAsset({
      action: action.message,
      nonce: action.nonce,
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
      failureReason:
        isPerpsActionUserCancelled(error) || isProviderUserRejected(error)
          ? 'userCancelled'
          : 'requestFailed',
      kind: 'failed',
    };
  }
};
