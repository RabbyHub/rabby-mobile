import { PERPS_BUILDER_INFO } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchAllDexsClearinghouseStateHttp,
  fetchAllDexsPositionOpenOrdersHttp,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import type {
  ClearinghouseState,
  OpenOrder,
} from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';
import {
  buildPerpsCancelOrdersCommand,
  executePerpsCancelOrders,
  type PerpsCancelOrderIntent,
  type PerpsCancelOrdersCommand,
  type PerpsCancelOrdersResult,
} from './cancelOrders';

export interface PerpsCloseAllPositionsCommand {
  account: Pick<Account, 'address' | 'type'>;
  clearinghouseState: ClearinghouseState;
  positions: ReadonlyArray<{ coin: string; signedSize: string }>;
  tpSlOrders: readonly PerpsCancelOrderIntent[];
  type: 'closeAllPositions';
}

export interface PerpsCloseAllPositionsResult {
  error?: string;
  failureReason?: 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'staleContext' | 'success';
  refreshError?: string;
  stage?: 'cancelTpSl' | 'closePositions';
}

export interface CloseAllPositionsDependencies {
  cancelOrders: (
    command: PerpsCancelOrdersCommand,
  ) => Promise<PerpsCancelOrdersResult>;
  closeAllPositions: (
    clearinghouseState: ClearinghouseState,
    slippage: number,
    builder: typeof PERPS_BUILDER_INFO,
  ) => Promise<unknown>;
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getCurrentClearinghouseState: () => ClearinghouseState | null;
  getCurrentOpenOrders: () => readonly OpenOrder[];
  refreshAllClearinghouse: () => Promise<unknown> | unknown;
  refreshAllOpenOrders: () => Promise<unknown> | unknown;
}

const getClosablePositions = (state: ClearinghouseState) =>
  state.assetPositions
    .filter(item => {
      const size = new BigNumber(item.position.szi || Number.NaN);
      return size.isFinite() && !size.isZero();
    })
    .map(item => ({
      coin: item.position.coin,
      signedSize: new BigNumber(item.position.szi).toFixed(),
    }));

const getActiveTpSlOrdersForPositions = (
  positions: readonly { coin: string }[],
  openOrders: readonly OpenOrder[],
): PerpsCancelOrderIntent[] => {
  const positionCoins = new Set(positions.map(position => position.coin));
  const seen = new Set<number>();
  return openOrders.reduce<PerpsCancelOrderIntent[]>((result, order) => {
    // frontendOpenOrders can nest dormant attached TP/SL beneath an unfilled
    // parent. Only top-level trigger orders are active and cancellable here.
    if (
      positionCoins.has(order.coin) &&
      order.reduceOnly &&
      order.isTrigger &&
      !seen.has(order.oid)
    ) {
      seen.add(order.oid);
      result.push({ coin: order.coin, oid: order.oid });
    }
    return result;
  }, []);
};

export const buildPerpsCloseAllPositionsCommand = (
  account: Pick<Account, 'address' | 'type'>,
  clearinghouseState: ClearinghouseState,
  openOrders: readonly OpenOrder[],
): PerpsCloseAllPositionsCommand => {
  if (!account.address) {
    throw new Error('Perps account is required');
  }
  const positions = getClosablePositions(clearinghouseState);
  if (positions.length === 0) {
    throw new Error('No Perps positions to close');
  }
  const tpSlOrders = getActiveTpSlOrdersForPositions(positions, openOrders);
  const frozenState = Object.freeze({
    ...clearinghouseState,
    assetPositions: Object.freeze(
      clearinghouseState.assetPositions.map(item =>
        Object.freeze({
          ...item,
          position: Object.freeze({ ...item.position }),
        }),
      ),
    ),
  }) as unknown as ClearinghouseState;
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    clearinghouseState: frozenState,
    positions: Object.freeze(
      positions.map(position => Object.freeze(position)),
    ),
    tpSlOrders: Object.freeze(
      tpSlOrders.map(order => Object.freeze({ ...order })),
    ),
    type: 'closeAllPositions' as const,
  });
};

const isPositionSnapshotCurrent = (
  command: PerpsCloseAllPositionsCommand,
  liveState: ClearinghouseState | null,
) => {
  if (!liveState) {
    return false;
  }
  const livePositions = getClosablePositions(liveState);
  if (livePositions.length !== command.positions.length) {
    return false;
  }
  const liveByCoin = new Map(
    livePositions.map(position => [position.coin, position.signedSize]),
  );
  return command.positions.every(position => {
    const liveSize = liveByCoin.get(position.coin);
    return (
      liveSize != null &&
      new BigNumber(liveSize).eq(new BigNumber(position.signedSize))
    );
  });
};

const orderSnapshotKey = (order: PerpsCancelOrderIntent) =>
  `${order.coin}:${order.oid}`;

const hasSameTpSlSnapshot = (
  command: PerpsCloseAllPositionsCommand,
  liveOrders: readonly OpenOrder[],
) => {
  const expected = command.tpSlOrders.map(orderSnapshotKey).sort();
  const current = getActiveTpSlOrdersForPositions(command.positions, liveOrders)
    .map(orderSnapshotKey)
    .sort();
  return (
    expected.length === current.length &&
    expected.every((key, index) => key === current[index])
  );
};

const hasNoActiveTpSlOrders = (
  command: PerpsCloseAllPositionsCommand,
  liveOrders: readonly OpenOrder[],
) =>
  getActiveTpSlOrdersForPositions(command.positions, liveOrders).length === 0;

const defaultDependencies: CloseAllPositionsDependencies = {
  cancelOrders: command => executePerpsCancelOrders(command),
  closeAllPositions: async (state, slippage, builder) => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) {
      throw new Error('Hyperliquid exchange client unavailable');
    }
    return exchange.closeAllPositions(state, slippage, builder);
  },
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getCurrentClearinghouseState: () =>
    perpsStore.getState().currentClearinghouseState,
  getCurrentOpenOrders: () => perpsStore.getState().openOrders,
  refreshAllClearinghouse: fetchAllDexsClearinghouseStateHttp,
  refreshAllOpenOrders: fetchAllDexsPositionOpenOrdersHttp,
};

const refreshSnapshots = async (
  dependencies: CloseAllPositionsDependencies,
): Promise<string | undefined> => {
  const runRefresh = async (refresh: () => Promise<unknown> | unknown) =>
    refresh();
  const results = await Promise.allSettled([
    runRefresh(dependencies.refreshAllOpenOrders),
    runRefresh(dependencies.refreshAllClearinghouse),
  ]);
  const errors = results.flatMap(result =>
    result.status === 'rejected'
      ? [
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        ]
      : [],
  );
  return errors.length > 0 ? errors.join('; ') : undefined;
};

const getCancelError = (result: PerpsCancelOrdersResult) =>
  result.items.find(item => item.status === 'failed')?.error ??
  'Not all associated TP/SL orders were cancelled';

export const executePerpsCloseAllPositions = async (
  command: PerpsCloseAllPositionsCommand,
  dependencies: CloseAllPositionsDependencies = defaultDependencies,
): Promise<PerpsCloseAllPositionsResult> => {
  if (
    !isSamePerpsActionAccount(
      dependencies.getCurrentAccount(),
      command.account,
    ) ||
    !isPositionSnapshotCurrent(
      command,
      dependencies.getCurrentClearinghouseState(),
    ) ||
    !hasSameTpSlSnapshot(command, dependencies.getCurrentOpenOrders())
  ) {
    return { kind: 'staleContext' };
  }

  if (command.tpSlOrders.length > 0) {
    let cancelResult: PerpsCancelOrdersResult;
    try {
      cancelResult = await dependencies.cancelOrders(
        buildPerpsCancelOrdersCommand(command.account, command.tpSlOrders),
      );
    } catch (error) {
      const refreshError = await refreshSnapshots(dependencies);
      return {
        error: error instanceof Error ? error.message : String(error),
        failureReason: isPerpsActionUserCancelled(error)
          ? 'userCancelled'
          : 'requestFailed',
        kind: 'failed',
        refreshError,
        stage: 'cancelTpSl',
      };
    }
    if (cancelResult.kind === 'staleContext') {
      await refreshSnapshots(dependencies);
      return { kind: 'staleContext' };
    }
    if (cancelResult.kind !== 'success') {
      const refreshError = await refreshSnapshots(dependencies);
      return {
        error: getCancelError(cancelResult),
        failureReason: cancelResult.failureReason ?? 'requestFailed',
        kind: 'failed',
        refreshError: cancelResult.refreshError ?? refreshError,
        stage: 'cancelTpSl',
      };
    }

    const refreshError = await refreshSnapshots(dependencies);
    if (refreshError) {
      return {
        error: 'Unable to verify associated TP/SL cancellation',
        failureReason: 'requestFailed',
        kind: 'failed',
        refreshError,
        stage: 'cancelTpSl',
      };
    }
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      ) ||
      !isPositionSnapshotCurrent(
        command,
        dependencies.getCurrentClearinghouseState(),
      ) ||
      !hasNoActiveTpSlOrders(command, dependencies.getCurrentOpenOrders())
    ) {
      return { kind: 'staleContext' };
    }
  }

  const liveCloseState = dependencies.getCurrentClearinghouseState();
  if (
    !liveCloseState ||
    !isSamePerpsActionAccount(
      dependencies.getCurrentAccount(),
      command.account,
    ) ||
    !isPositionSnapshotCurrent(command, liveCloseState) ||
    !hasNoActiveTpSlOrders(command, dependencies.getCurrentOpenOrders())
  ) {
    return { kind: 'staleContext' };
  }

  try {
    const response = await dependencies.closeAllPositions(
      liveCloseState,
      0.08,
      PERPS_BUILDER_INFO,
    );
    const responseShape = response as {
      response?: { data?: { statuses?: unknown[] } };
      status?: unknown;
    };
    const statuses = responseShape.response?.data?.statuses ?? [];
    const filledCount = statuses.filter(
      status => !!(status as { filled?: unknown })?.filled,
    ).length;
    const firstError = statuses
      .map(status => (status as { error?: string })?.error)
      .find(Boolean);

    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return { kind: 'staleContext' };
    }

    const refreshError = await refreshSnapshots(dependencies);
    if (
      responseShape.status !== 'ok' ||
      statuses.length !== command.positions.length ||
      filledCount !== command.positions.length
    ) {
      return {
        error: firstError || 'Not all Hyperliquid positions were filled',
        failureReason: 'requestFailed',
        kind: 'failed',
        refreshError,
        stage: 'closePositions',
      };
    }
    return { kind: 'success', refreshError };
  } catch (error) {
    const refreshError = await refreshSnapshots(dependencies);
    return {
      error: error instanceof Error ? error.message : String(error),
      failureReason: isPerpsActionUserCancelled(error)
        ? 'userCancelled'
        : 'requestFailed',
      kind: 'failed',
      refreshError,
      stage: 'closePositions',
    };
  }
};
