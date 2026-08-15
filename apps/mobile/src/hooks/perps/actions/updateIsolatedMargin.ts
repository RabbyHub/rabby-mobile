import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchClearinghouseStateHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import BigNumber from 'bignumber.js';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export interface PerpsUpdateIsolatedMarginCommand {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  dexId: string;
  expectedSignedSize: string;
  targetMargin: string;
  type: 'updateIsolatedMargin';
}

export interface PerpsUpdateIsolatedMarginLiveContext {
  account: Pick<Account, 'address' | 'type'> | null;
  dexId: string;
  hasPermission: boolean;
  position: {
    leverageType: string | null;
    marginUsed: string;
    signedSize: string;
  } | null;
}

export interface PerpsUpdateIsolatedMarginResult {
  delta?: string;
  error?: string;
  failureReason?: 'regionRestricted' | 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'noChange' | 'staleContext' | 'success' | 'unknownOutcome';
  refreshError?: string;
}

export interface UpdateIsolatedMarginDependencies {
  getLiveContext: (coin: string) => PerpsUpdateIsolatedMarginLiveContext;
  refresh: (dex: string) => Promise<unknown> | unknown;
  updateIsolatedMargin: (params: {
    coin: string;
    value: number;
  }) => Promise<unknown>;
}

const finite = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() ? result : null;
};

const trimFixedDecimal = (value: string) =>
  value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export const buildPerpsUpdateIsolatedMarginCommand = ({
  account,
  coin,
  dexId,
  expectedSignedSize,
  targetMargin,
}: Omit<
  PerpsUpdateIsolatedMarginCommand,
  'type'
>): PerpsUpdateIsolatedMarginCommand => {
  const normalizedCoin = coin.trim();
  const size = finite(expectedSignedSize);
  const target = finite(targetMargin);
  if (
    !account.address ||
    !normalizedCoin ||
    !size ||
    size.isZero() ||
    !target ||
    target.isNegative() ||
    (target.decimalPlaces() ?? Number.POSITIVE_INFINITY) > 2
  ) {
    throw new Error('Invalid isolated margin update');
  }
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    coin: normalizedCoin,
    dexId,
    expectedSignedSize: size.toFixed(),
    targetMargin: target.toFixed(),
    type: 'updateIsolatedMargin' as const,
  });
};

const getDefaultLiveContext = (
  coin: string,
): PerpsUpdateIsolatedMarginLiveContext => {
  const state = perpsStore.getState();
  const position = state.currentClearinghouseState?.assetPositions.find(
    item => item.position.coin === coin,
  )?.position;
  return {
    account: state.currentPerpsAccount,
    dexId: getDexByCoin(coin),
    hasPermission: state.hasPermission,
    position: position
      ? {
          leverageType: position.leverage?.type ?? null,
          marginUsed: String(position.marginUsed ?? ''),
          signedSize: String(position.szi ?? ''),
        }
      : null,
  };
};

const defaultDependencies: UpdateIsolatedMarginDependencies = {
  getLiveContext: getDefaultLiveContext,
  refresh: dex => fetchClearinghouseStateHttp(dex),
  updateIsolatedMargin: async params => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) {
      throw new Error('Hyperliquid exchange client unavailable');
    }
    return exchange.updateIsolatedMargin(params);
  },
};

const matchesCommandContext = (
  command: PerpsUpdateIsolatedMarginCommand,
  context: PerpsUpdateIsolatedMarginLiveContext,
) =>
  isSamePerpsActionAccount(context.account, command.account) &&
  context.dexId === command.dexId &&
  context.position?.leverageType === 'isolated' &&
  finite(context.position.signedSize)?.eq(command.expectedSignedSize) === true;

const isUnknownOutcomeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network request failed|failed to fetch|connection|socket/i.test(
    message,
  );
};

const refreshFacts = async (
  dexId: string,
  dependencies: UpdateIsolatedMarginDependencies,
) => {
  try {
    await dependencies.refresh(dexId);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

export const executePerpsUpdateIsolatedMargin = async (
  command: PerpsUpdateIsolatedMarginCommand,
  dependencies: UpdateIsolatedMarginDependencies = defaultDependencies,
  sceneGuard?: () => boolean,
): Promise<PerpsUpdateIsolatedMarginResult> => {
  if (command.type !== 'updateIsolatedMargin') {
    return {
      error: 'Invalid isolated margin command',
      failureReason: 'requestFailed',
      kind: 'failed',
    };
  }
  const liveContext = dependencies.getLiveContext(command.coin);
  if (!liveContext.hasPermission) {
    return { failureReason: 'regionRestricted', kind: 'failed' };
  }
  if (
    !(sceneGuard?.() ?? true) ||
    !matchesCommandContext(command, liveContext)
  ) {
    return { kind: 'staleContext' };
  }
  const targetMargin = finite(command.targetMargin);
  if (!targetMargin) {
    return { kind: 'staleContext' };
  }

  let delta: string | undefined;
  try {
    const latestContext = dependencies.getLiveContext(command.coin);
    if (
      !latestContext.hasPermission ||
      !(sceneGuard?.() ?? true) ||
      !matchesCommandContext(command, latestContext)
    ) {
      return latestContext.hasPermission
        ? { kind: 'staleContext' }
        : { failureReason: 'regionRestricted', kind: 'failed' };
    }
    const latestMargin = finite(latestContext.position?.marginUsed);
    if (!latestMargin || latestMargin.isNegative()) {
      return { kind: 'staleContext' };
    }
    const roundedDelta = targetMargin
      .minus(latestMargin)
      .decimalPlaces(6, BigNumber.ROUND_HALF_UP);
    delta = trimFixedDecimal(roundedDelta.toFixed(6));
    if (roundedDelta.isZero()) {
      return { delta: '0', kind: 'noChange' };
    }
    const wireValue = Number(delta);
    if (!Number.isFinite(wireValue)) {
      return {
        error: 'Invalid isolated margin delta',
        failureReason: 'requestFailed',
        kind: 'failed',
      };
    }
    const response = await dependencies.updateIsolatedMargin({
      coin: command.coin,
      value: wireValue,
    });
    const payload = response as { response?: unknown; status?: unknown };
    if (payload?.status !== 'ok') {
      if (payload?.status == null) {
        const refreshError = await refreshFacts(command.dexId, dependencies);
        return {
          delta,
          error: 'Missing Hyperliquid margin update outcome',
          kind: 'unknownOutcome',
          refreshError,
        };
      }
      return {
        delta,
        error:
          typeof payload.response === 'string' && payload.response
            ? payload.response
            : 'Hyperliquid rejected margin update',
        failureReason: 'requestFailed',
        kind: 'failed',
      };
    }
    const refreshError = await refreshFacts(command.dexId, dependencies);
    if (
      !isSamePerpsActionAccount(
        dependencies.getLiveContext(command.coin).account,
        command.account,
      ) ||
      !(sceneGuard?.() ?? true)
    ) {
      return { delta, kind: 'staleContext', refreshError };
    }
    return { delta, kind: 'success', refreshError };
  } catch (error) {
    if (isPerpsActionUserCancelled(error)) {
      return { failureReason: 'userCancelled', kind: 'failed' };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (isUnknownOutcomeError(error)) {
      const refreshError = await refreshFacts(command.dexId, dependencies);
      return {
        delta,
        error: message,
        kind: 'unknownOutcome',
        refreshError,
      };
    }
    return {
      delta,
      error: message,
      failureReason: 'requestFailed',
      kind: 'failed',
    };
  }
};
