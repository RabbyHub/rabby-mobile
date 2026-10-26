import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchClearinghouseStateHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export interface PerpsUpdateLeverageCommand {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  isCross: boolean;
  leverage: number;
  maxLeverage: number;
  type: 'updateLeverage';
}

export interface PerpsUpdateLeverageResult {
  error?: string;
  failureReason?: 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'staleContext' | 'success';
  refreshError?: string;
}

export interface UpdateLeverageDependencies {
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  refresh: (dex: string) => Promise<unknown> | unknown;
  resolveDex: (coin: string) => string;
  updateLeverage: (params: {
    coin: string;
    isCross: boolean;
    leverage: number;
  }) => Promise<unknown>;
}

export const buildPerpsUpdateLeverageCommand = ({
  account,
  coin,
  isCross,
  leverage,
  maxLeverage,
}: Omit<PerpsUpdateLeverageCommand, 'type'>): PerpsUpdateLeverageCommand => {
  const normalizedCoin = coin.trim();
  if (!account.address || !normalizedCoin) {
    throw new Error('Perps account and coin are required');
  }
  if (
    !Number.isSafeInteger(maxLeverage) ||
    maxLeverage < 1 ||
    !Number.isSafeInteger(leverage) ||
    leverage < 1 ||
    leverage > maxLeverage
  ) {
    throw new Error('Invalid Perps leverage');
  }
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    coin: normalizedCoin,
    isCross,
    leverage,
    maxLeverage,
    type: 'updateLeverage' as const,
  });
};

const defaultDependencies: UpdateLeverageDependencies = {
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  refresh: dex => fetchClearinghouseStateHttp(dex),
  resolveDex: coin => getDexByCoin(coin),
  updateLeverage: async params => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) {
      throw new Error('Hyperliquid exchange client unavailable');
    }
    return exchange.updateLeverage(params);
  },
};

export const executePerpsUpdateLeverage = async (
  command: PerpsUpdateLeverageCommand,
  dependencies: UpdateLeverageDependencies = defaultDependencies,
): Promise<PerpsUpdateLeverageResult> => {
  if (
    !isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account)
  ) {
    return { kind: 'staleContext' };
  }
  try {
    const response = await dependencies.updateLeverage({
      coin: command.coin,
      isCross: command.isCross,
      leverage: command.leverage,
    });
    if ((response as { status?: unknown })?.status !== 'ok') {
      throw new Error('Hyperliquid rejected leverage update');
    }
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return { kind: 'staleContext' };
    }
    let refreshError: string | undefined;
    try {
      await dependencies.refresh(dependencies.resolveDex(command.coin));
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return { kind: 'staleContext', refreshError };
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
