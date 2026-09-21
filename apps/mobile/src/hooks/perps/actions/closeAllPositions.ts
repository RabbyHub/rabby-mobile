import { PERPS_BUILDER_INFO } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchAllDexsClearinghouseStateHttp,
  fetchAllDexsPositionOpenOrdersHttp,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export interface PerpsCloseAllPositionsCommand {
  account: Pick<Account, 'address' | 'type'>;
  clearinghouseState: ClearinghouseState;
  positions: ReadonlyArray<{ coin: string; signedSize: string }>;
  type: 'closeAllPositions';
}

export interface PerpsCloseAllPositionsResult {
  confirmedFills?: readonly PerpsCloseAllConfirmedFill[];
  error?: string;
  failureReason?: 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'staleContext' | 'success' | 'unknownOutcome';
  refreshError?: string;
}

export type PerpsCloseAllConfirmedFill = Readonly<{
  coin: string;
  oid?: number;
  price: string;
  signedSize: string;
  size: string;
}>;

export interface CloseAllPositionsDependencies {
  closeAllPositions: (
    clearinghouseState: ClearinghouseState,
    slippage: number,
    builder: typeof PERPS_BUILDER_INFO,
  ) => Promise<unknown>;
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getCurrentClearinghouseState: () => ClearinghouseState | null;
  refreshAllClearinghouse: () => Promise<unknown> | unknown;
  refreshAllOpenOrders: () => Promise<unknown> | unknown;
}

type CloseAllOrderStatus = {
  error?: unknown;
  filled?: {
    avgPx?: unknown;
    oid?: unknown;
    totalSz?: unknown;
  };
};

type CloseAllResponseAnalysis = {
  confirmedFills: readonly PerpsCloseAllConfirmedFill[];
  error?: string;
  isCompleteFill: boolean;
};

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

export const buildPerpsCloseAllPositionsCommand = (
  account: Pick<Account, 'address' | 'type'>,
  clearinghouseState: ClearinghouseState,
): PerpsCloseAllPositionsCommand => {
  if (!account.address) {
    throw new Error('Perps account is required');
  }
  const positions = getClosablePositions(clearinghouseState);
  if (positions.length === 0) {
    throw new Error('No Perps positions to close');
  }
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

const getTargetPositionReconciliationError = (
  command: PerpsCloseAllPositionsCommand,
  liveState: ClearinghouseState | null,
) => {
  if (!liveState) {
    return 'Unable to verify positions after the close request';
  }
  const liveByCoin = new Map(
    liveState.assetPositions.map(item => [
      item.position.coin,
      item.position.szi,
    ]),
  );
  const errors = command.positions.flatMap(position => {
    const rawSize = liveByCoin.get(position.coin);
    if (rawSize == null) {
      return [];
    }
    const size = new BigNumber(rawSize || Number.NaN);
    if (!size.isFinite()) {
      return [`Unable to verify ${position.coin} position after close request`];
    }
    return size.isZero()
      ? []
      : [
          `${position.coin} position remains open (${size
            .abs()
            .toFixed()}) after close request`,
        ];
  });
  return errors.length > 0 ? errors.join('\n') : undefined;
};

const defaultDependencies: CloseAllPositionsDependencies = {
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
  refreshAllClearinghouse: fetchAllDexsClearinghouseStateHttp,
  refreshAllOpenOrders: fetchAllDexsPositionOpenOrdersHttp,
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const refreshSnapshots = async (
  dependencies: CloseAllPositionsDependencies,
): Promise<{ clearinghouseError?: string; refreshError?: string }> => {
  const runRefresh = (refresh: () => Promise<unknown> | unknown) =>
    Promise.resolve().then(refresh);
  const [openOrdersResult, clearinghouseResult] = await Promise.allSettled([
    runRefresh(dependencies.refreshAllOpenOrders),
    runRefresh(dependencies.refreshAllClearinghouse),
  ]);
  const openOrdersError =
    openOrdersResult.status === 'rejected'
      ? errorMessage(openOrdersResult.reason)
      : undefined;
  const clearinghouseError =
    clearinghouseResult.status === 'rejected'
      ? errorMessage(clearinghouseResult.reason)
      : undefined;
  const refreshError = [openOrdersError, clearinghouseError]
    .filter((message): message is string => !!message)
    .join('; ');
  return {
    clearinghouseError,
    refreshError: refreshError || undefined,
  };
};

const nonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : undefined;

const getResponseStatuses = (response: unknown): unknown[] => {
  const statuses = (
    response as { response?: { data?: { statuses?: unknown } } }
  )?.response?.data?.statuses;
  return Array.isArray(statuses) ? statuses : [];
};

const getResponseError = (response: unknown) => {
  if (typeof response === 'string' && response) {
    return response;
  }
  const shape = response as
    | {
        error?: unknown;
        response?: string | { data?: { error?: unknown }; error?: unknown };
      }
    | null
    | undefined;
  const responseValue = shape?.response;
  if (typeof responseValue === 'string') {
    return responseValue || undefined;
  }
  return (
    nonEmptyString(responseValue?.data?.error) ??
    nonEmptyString(responseValue?.error) ??
    nonEmptyString(shape?.error)
  );
};

const getStatusError = (status: unknown) => {
  if (typeof status === 'string' && status && status !== 'success') {
    return status;
  }
  return nonEmptyString((status as CloseAllOrderStatus | null)?.error);
};

const uniqueMessages = (messages: readonly string[]) =>
  [...new Set(messages)].join('\n');

const analyzeCloseAllResponse = (
  response: unknown,
  submittedPositions: readonly { coin: string; signedSize: string }[],
): CloseAllResponseAnalysis => {
  const responseShape = response as { status?: unknown } | null | undefined;
  const statuses = getResponseStatuses(response);
  const serverErrors = [
    getResponseError(response),
    ...statuses.map(getStatusError),
  ].filter((message): message is string => !!message);
  const validationErrors: string[] = [];
  const confirmedFills: PerpsCloseAllConfirmedFill[] = [];
  let isCompleteFill =
    responseShape?.status === 'ok' &&
    statuses.length === submittedPositions.length;

  if (responseShape?.status !== 'ok' && serverErrors.length === 0) {
    validationErrors.push('Hyperliquid rejected the close request');
  }
  if (statuses.length !== submittedPositions.length) {
    validationErrors.push(
      `Hyperliquid returned ${statuses.length} close statuses for ${submittedPositions.length} positions`,
    );
  }

  submittedPositions.forEach((position, index) => {
    const status = statuses[index] as CloseAllOrderStatus | null | undefined;
    const filled = status?.filled;
    const statusError = getStatusError(status);
    const totalSize = nonEmptyString(filled?.totalSz);
    const filledSize = new BigNumber(totalSize || Number.NaN);
    const expectedSize = new BigNumber(position.signedSize).abs();

    if (filled && filledSize.isFinite() && filledSize.gt(0)) {
      confirmedFills.push(
        Object.freeze({
          coin: position.coin,
          oid: typeof filled.oid === 'number' ? filled.oid : undefined,
          price: nonEmptyString(filled.avgPx) ?? '',
          signedSize: position.signedSize,
          size: filledSize.toFixed(),
        }),
      );
    }

    if (statusError) {
      isCompleteFill = false;
      return;
    }
    if (!filled || !filledSize.isFinite() || !filledSize.gt(0)) {
      isCompleteFill = false;
      validationErrors.push(
        `Hyperliquid did not return a valid fill for ${position.coin}`,
      );
      return;
    }
    if (!filledSize.eq(expectedSize)) {
      isCompleteFill = false;
      validationErrors.push(
        `${
          position.coin
        } was filled ${filledSize.toFixed()} of ${expectedSize.toFixed()}`,
      );
    }
  });

  return {
    confirmedFills: Object.freeze(confirmedFills),
    error:
      serverErrors.length > 0
        ? uniqueMessages(serverErrors)
        : validationErrors.length > 0
        ? uniqueMessages(validationErrors)
        : undefined,
    isCompleteFill,
  };
};

const isUnknownOutcomeError = (error: unknown) =>
  /timeout|network request failed|failed to fetch|connection/i.test(
    errorMessage(error),
  );

export const executePerpsCloseAllPositions = async (
  command: PerpsCloseAllPositionsCommand,
  dependencies: CloseAllPositionsDependencies = defaultDependencies,
): Promise<PerpsCloseAllPositionsResult> => {
  const liveCloseState = dependencies.getCurrentClearinghouseState();
  if (
    !isSamePerpsActionAccount(
      dependencies.getCurrentAccount(),
      command.account,
    ) ||
    !isPositionSnapshotCurrent(command, liveCloseState)
  ) {
    return { kind: 'staleContext' };
  }

  try {
    const submittedPositions = getClosablePositions(liveCloseState!);
    const response = await dependencies.closeAllPositions(
      liveCloseState!,
      0.08,
      PERPS_BUILDER_INFO,
    );
    const analysis = analyzeCloseAllResponse(response, submittedPositions);

    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return {
        confirmedFills: analysis.confirmedFills,
        kind: 'staleContext',
      };
    }

    const { clearinghouseError, refreshError } = await refreshSnapshots(
      dependencies,
    );
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return {
        confirmedFills: analysis.confirmedFills,
        kind: 'staleContext',
        refreshError,
      };
    }
    const reconciliationError = getTargetPositionReconciliationError(
      command,
      dependencies.getCurrentClearinghouseState(),
    );

    if (analysis.error || !analysis.isCompleteFill) {
      return {
        confirmedFills: analysis.confirmedFills,
        error: analysis.error || 'Hyperliquid close response was incomplete',
        failureReason: 'requestFailed',
        kind: 'failed',
        refreshError,
      };
    }
    if (clearinghouseError) {
      return {
        confirmedFills: analysis.confirmedFills,
        error: clearinghouseError,
        kind: 'unknownOutcome',
        refreshError,
      };
    }
    if (reconciliationError) {
      return {
        confirmedFills: analysis.confirmedFills,
        error: reconciliationError,
        failureReason: 'requestFailed',
        kind: 'failed',
        refreshError,
      };
    }
    return {
      confirmedFills: analysis.confirmedFills,
      kind: 'success',
      refreshError,
    };
  } catch (error) {
    if (isPerpsActionUserCancelled(error)) {
      return {
        error: errorMessage(error),
        failureReason: 'userCancelled',
        kind: 'failed',
      };
    }
    const { refreshError } = await refreshSnapshots(dependencies);
    const unknownOutcome = isUnknownOutcomeError(error);
    return {
      error: errorMessage(error),
      failureReason: unknownOutcome ? undefined : 'requestFailed',
      kind: unknownOutcome ? 'unknownOutcome' : 'failed',
      refreshError,
    };
  }
};
