import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import {
  clearGasAccountPendingHardwareAccountSync,
  ensureGasAccountServiceReady,
  getGasAccountData,
  getGasAccountAccountsWithBalanceSnapshot,
  getGasAccountDataSnapshot,
  getGasAccountPendingHardwareAccountSnapshot,
  setGasAccountAccountsWithBalanceSync,
  setGasAccountCurrentBalanceStateSync,
  setGasAccountHasClaimedGiftSync,
  setGasAccountPendingHardwareAccountSync,
  setGasAccountSigSync,
} from '@/core/serviceApi/gasAccount';
import {
  bindKeyringEventSync,
  keyringServiceApi,
} from '@/core/serviceApi/keyring';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import type {
  GasAccountRuntimeAccount,
  GasAccountService,
  GasAccountServiceStore,
} from '@/core/services/gasAccount';
import type { Account } from '@/core/startupServices/preference';
import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
} from '@/core/utils/store';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { eventBus, EVENTS } from '@/utils/events';
import { handleGasAccountLoginSuccess } from '@/utils/gasAccountAnalytics';
import { setGasAccountStoreApi } from '@/utils/gasAccountStoreApiBridge';
import { sendPersonalMessage } from '@/utils/sendPersonalMessage';
import {
  ensureWalletUnlocked,
  isWalletUnlockCancelled,
} from '@/utils/walletUnlock';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type { GasAccountBridgeToken } from '@rabby-wallet/rabby-api/dist/types';
import type { KeyringEventAccount } from '@rabby-wallet/service-keyring';
import pRetry from 'p-retry';
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  GasAccountBalanceAccount,
  GasAccountSessionAccount,
  GasAccountState,
} from './state';
import {
  createInitialGasAccountState,
  failHistoryRefreshState,
  failSnapshotRefreshState,
  finishHistoryRefreshState,
  finishSnapshotRefreshState,
  invalidateSessionState,
  markSnapshotDirtyState,
  startHistoryRefreshState,
  startSnapshotRefreshState,
  updateDiscoveryState,
  updateSessionState,
} from './state';

const traceGasAccountStore = (
  event: string,
  data: Record<string, unknown> = {},
) => {
  traceStartupDiagnostic('gas-account-store', event, data);
};

const measureGasAccountStoreSyncStep = <T>(
  label: string,
  task: () => T,
  data: Record<string, unknown> = {},
) => {
  const startedAt = Date.now();
  traceGasAccountStore('sync_step_start', {
    label,
    ...data,
  });
  try {
    const result = task();
    traceGasAccountStore('sync_step_end', {
      label,
      durationMs: Date.now() - startedAt,
      ...data,
    });
    return result;
  } catch (error) {
    traceGasAccountStore('sync_step_error', {
      label,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      ...data,
    });
    throw error;
  }
};

const traceGasAccountStoreAsyncStep = async <T>(
  label: string,
  task: () => Promise<T> | T,
  data: Record<string, unknown> = {},
) => {
  const startedAt = Date.now();
  traceGasAccountStore('async_step_start', {
    label,
    ...data,
  });
  try {
    const result = await task();
    traceGasAccountStore('async_step_end', {
      label,
      durationMs: Date.now() - startedAt,
      ...data,
    });
    return result;
  } catch (error) {
    traceGasAccountStore('async_step_error', {
      label,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      ...data,
    });
    throw error;
  }
};

runStartupTask(() => {
  eventBus.on(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, () => {
    void storeApiGasAccount.ensureRuntimeReady().catch(error => {
      console.error('hydrate gas account after auto login event error', error);
    });
  });
  eventBus.on(EVENTS.TX_COMPLETED, () => {
    void storeApiGasAccount
      .ensureRuntimeReady()
      .then(() => {
        storeApiGasAccount.scheduleSnapshotRefresh({
          reason: 'tx_completed',
        });
      })
      .catch(error => {
        console.error('refresh gas account after transaction error', error);
      });
  });
}, STARTUP_TASKS.gasAccountEventBridge);

type GasAccountVisibleState = {
  loginVisible: boolean;
  switchVisible: boolean;
};

export type GasAccountBridgeSupportTokenList = {
  hyperliquid_tokens: GasAccountBridgeToken[];
  wallet_tokens: GasAccountBridgeToken[];
};

type OpenApiWithGasAccountBridgeSupportTokenList = typeof openapi & {
  getGasAccountBridgeSupportTokenList?: () => Promise<
    Partial<GasAccountBridgeSupportTokenList> | undefined
  >;
};

type GasAccountInfoResponse = Awaited<
  ReturnType<typeof openapi.getGasAccountInfo>
>;
type GasAccountHistoryResponse = Awaited<
  ReturnType<typeof openapi.getGasAccountHistory>
>;
type GasAccountHistoryItem = NonNullable<
  GasAccountHistoryResponse['history_list']
>[number];
type GasAccountPendingHistoryItem = NonNullable<
  GasAccountHistoryResponse['recharge_list']
>[number];
type GasAccountZustandState = GasAccountState<
  GasAccountInfoResponse,
  GasAccountHistoryItem,
  GasAccountPendingHistoryItem
> &
  GasAccountVisibleState;

const getSessionStateFromData = (
  data: Partial<GasAccountServiceStore> | undefined,
) => {
  const hasSession = !!data?.sig && !!data?.accountId;

  return {
    sig: data?.sig,
    accountId: data?.accountId,
    account: data?.account as GasAccountSessionAccount | undefined,
    status: hasSession ? ('logged_in' as const) : ('idle' as const),
  };
};

const getDiscoveryStateFromRuntime = () => ({
  pendingHardwareAccount: getGasAccountPendingHardwareAccountSnapshot() as
    | GasAccountRuntimeAccount
    | undefined,
  accountsWithBalance:
    getGasAccountAccountsWithBalanceSnapshot() as GasAccountBalanceAccount[],
  status: 'idle' as const,
});

function setVisibleFor(
  key: keyof GasAccountVisibleState,
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  gasAccountStore.setState(prev => {
    const newVal = resolveValFromUpdater(prev[key] ?? false, valOrFunc).newVal;

    return {
      ...prev,
      [key]: newVal,
    };
  });
}

export const gasAccountStore = zCreate<GasAccountZustandState>(() => ({
  ...createInitialGasAccountState<
    GasAccountInfoResponse,
    GasAccountHistoryItem,
    GasAccountPendingHistoryItem
  >({
    session: getSessionStateFromData(undefined),
    discovery: {
      pendingHardwareAccount: undefined,
      accountsWithBalance: [],
      status: 'idle',
    },
  }),
  loginVisible: false,
  switchVisible: false,
}));

type GasAccountDepositState = {
  bridgeSupportTokenList: GasAccountBridgeSupportTokenList;
  // 缓存更新时间，用于 TTL 判断
  bridgeSupportUpdatedAt: number;
};

type GasAccountDepositRuntimeState = {
  // 仅运行时 loading，不持久化
  bridgeSupportLoading: boolean;
};

const EMPTY_GAS_ACCOUNT_BRIDGE_SUPPORT_TOKEN_LIST: GasAccountBridgeSupportTokenList =
  {
    hyperliquid_tokens: [],
    wallet_tokens: [],
  };
const GAS_ACCOUNT_BRIDGE_SUPPORT_CACHE_TTL = 5 * 60 * 1000;
const GAS_ACCOUNT_BRIDGE_SUPPORT_CACHE_KEY =
  '@GasAccountBridgeSupportTokenList';
const gasAccountDepositOpenapi =
  openapi as OpenApiWithGasAccountBridgeSupportTokenList;

const defaultGasAccountDepositState: GasAccountDepositState = {
  bridgeSupportTokenList: EMPTY_GAS_ACCOUNT_BRIDGE_SUPPORT_TOKEN_LIST,
  bridgeSupportUpdatedAt: 0,
};

export const gasAccountDepositStore = zustandByMMKV<GasAccountDepositState>(
  GAS_ACCOUNT_BRIDGE_SUPPORT_CACHE_KEY,
  defaultGasAccountDepositState,
  { storage: MMKVStorageStrategy.compatJson },
);

const gasAccountDepositRuntimeStore = zCreate<GasAccountDepositRuntimeState>(
  () => ({
    bridgeSupportLoading: false,
  }),
);

const hasBridgeSupportTokenCache = () =>
  gasAccountDepositStore.getState().bridgeSupportUpdatedAt > 0;

const normalizeBridgeSupportTokenList = (
  result?: Partial<GasAccountBridgeSupportTokenList>,
): GasAccountBridgeSupportTokenList => ({
  hyperliquid_tokens: result?.hyperliquid_tokens || [],
  wallet_tokens: result?.wallet_tokens || [],
});

const refreshGasAccountBridgeSupportTokenList = makeAvoidParallelAsyncFunc(
  async () => {
    gasAccountDepositRuntimeStore.setState({
      bridgeSupportLoading: !hasBridgeSupportTokenCache(),
    });

    try {
      const result =
        await gasAccountDepositOpenapi.getGasAccountBridgeSupportTokenList?.();
      const normalized = normalizeBridgeSupportTokenList(result);

      gasAccountDepositStore.setState({
        bridgeSupportTokenList: normalized,
        bridgeSupportUpdatedAt: Date.now(),
      });

      return normalized;
    } finally {
      gasAccountDepositRuntimeStore.setState({ bridgeSupportLoading: false });
    }
  },
);

const fetchGasAccountBridgeSupportTokenList = async () => {
  const { bridgeSupportTokenList, bridgeSupportUpdatedAt } =
    gasAccountDepositStore.getState();
  const now = Date.now();
  const hasCache = bridgeSupportUpdatedAt > 0;
  const isFresh =
    hasCache &&
    now - bridgeSupportUpdatedAt < GAS_ACCOUNT_BRIDGE_SUPPORT_CACHE_TTL;

  if (isFresh) {
    return bridgeSupportTokenList;
  }

  if (hasCache) {
    refreshGasAccountBridgeSupportTokenList().catch(error => {
      console.error('refreshGasAccountBridgeSupportTokenList error', error);
    });
    return bridgeSupportTokenList;
  }

  return refreshGasAccountBridgeSupportTokenList();
};

if (gasAccountDepositRuntimeStore.getState().bridgeSupportLoading) {
  gasAccountDepositRuntimeStore.setState({
    bridgeSupportLoading: false,
  });
}

export const cleanupGasAccountAfterDeletedAddress = async (address: string) => {
  const restAddresses = await keyringServiceApi.getAllAddresses();
  const gasAccount = (await getGasAccountData()) as GasAccountServiceStore;
  if (gasAccount?.account?.address) {
    // check if there is another type address in wallet
    const stillHasAddr = restAddresses.some(item => {
      return (
        isSameAddress(item.address, gasAccount.account!.address) &&
        item.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });
    if (!stillHasAddr && isSameAddress(address, gasAccount.account.address)) {
      // if there is no another type address then reset signature
      setGasAccountSigSync();
      eventBus.emit(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, null);
    }
  }
};

const syncDeleteGasAccount = async ({
  address,
  type,
  brandName: _brandName,
}: KeyringEventAccount) => {
  if (type !== KEYRING_TYPE.WatchAddressKeyring) {
    /**
     * keep gas account session
     */
    // cleanupGasAccountAfterDeletedAddress(address);
    const perpsAccount = await perpsServiceApi.getCurrentAccount();
    if (
      isSameAddress(perpsAccount?.address || '', address) &&
      perpsAccount?.type === type
    ) {
      eventBus.emit(EVENTS.PERPS.LOG_OUT, perpsAccount);
      await perpsServiceApi.setCurrentAccount(null);
    }
  }
};
bindKeyringEventSync('removedAccount', syncDeleteGasAccount);

export const useGasAccountSign = () => {
  return gasAccountStore(
    useShallow(state => ({
      sig: state.session.sig,
      accountId: state.session.accountId,
      account: state.session.account,
      status: state.session.status,
    })),
  );
};

const setGasAccount = (
  sig?: string,
  account?: GasAccountServiceStore['account'],
) => {
  setGasAccountSigSync(sig, account);
  if (!sig || !account) {
    setGasAccountCurrentBalanceStateSync();
    gasAccountStore.setState(prev => invalidateSessionState(prev));
    return;
  }

  gasAccountStore.setState(prev =>
    markSnapshotDirtyState(
      updateSessionState(prev, {
        sig,
        accountId: account.address,
        account: account as GasAccountSessionAccount,
        status: 'logged_in',
      }),
      'session_changed',
    ),
  );
};

const hydrateSessionFromData = (
  data: Partial<GasAccountServiceStore> | undefined,
  source = 'unknown',
) => {
  const nextSession = getSessionStateFromData(data);
  let previousStatus = gasAccountStore.getState().session.status;
  let changed = false;
  let changeReason = 'unknown';

  measureGasAccountStoreSyncStep(
    'hydrate_session_set_state',
    () => {
      gasAccountStore.setState(prev => {
        previousStatus = prev.session.status;
        if (nextSession.status !== 'logged_in') {
          if (
            prev.session.status === 'logged_in' ||
            prev.session.status === 'logging_in'
          ) {
            changed = false;
            changeReason = 'keep_existing_session';
            return prev;
          }
          changed = true;
          changeReason = 'update_empty_session';
          return updateSessionState(prev, nextSession);
        }

        const isSameSession =
          prev.session.sig === nextSession.sig &&
          prev.session.accountId === nextSession.accountId &&
          prev.session.account?.address === nextSession.account?.address &&
          prev.session.account?.type === nextSession.account?.type &&
          prev.session.account?.brandName === nextSession.account?.brandName &&
          prev.session.status === nextSession.status;

        if (isSameSession) {
          changed = false;
          changeReason = 'same_session';
          return prev;
        }

        changed = true;
        changeReason = 'session_hydrated';
        return markSnapshotDirtyState(
          updateSessionState(prev, nextSession),
          'session_hydrated',
        );
      });
    },
    {
      source,
      previousStatus,
      nextStatus: nextSession.status,
      hasSig: !!nextSession.sig,
      hasAccountId: !!nextSession.accountId,
    },
  );

  traceGasAccountStore('hydrate_session_result', {
    source,
    previousStatus,
    nextStatus: nextSession.status,
    changed,
    changeReason,
    hasSig: !!nextSession.sig,
    hasAccountId: !!nextSession.accountId,
  });

  return nextSession;
};

export function prepareGasAccountStoreFromService(service: GasAccountService) {
  const nextSession = hydrateSessionFromData(
    service.getGasAccountData() as GasAccountServiceStore,
    'prepare_service',
  );

  measureGasAccountStoreSyncStep(
    'prepare_service_discovery_set_state',
    () => {
      gasAccountStore.setState(prev => ({
        ...prev,
        discovery: {
          ...prev.discovery,
          pendingHardwareAccount: service.getPendingHardwareAccount() as
            | GasAccountRuntimeAccount
            | undefined,
          accountsWithBalance:
            service.getAccountsWithGasAccountBalance() as GasAccountBalanceAccount[],
          status: 'idle',
        },
      }));
    },
    {
      hasPendingHardwareAccount: !!service.getPendingHardwareAccount(),
      accountsWithBalanceCount:
        service.getAccountsWithGasAccountBalance()?.length || 0,
    },
  );

  return nextSession;
}

const hydrateSessionFromLoadedService = () =>
  hydrateSessionFromData(
    getGasAccountDataSnapshot() as GasAccountServiceStore,
    'runtime_ready',
  );

const ensureGasAccountRuntimeReady = makeAvoidParallelAsyncFunc(async () => {
  const startedAt = Date.now();
  traceGasAccountStore('ensure_runtime_ready_start');

  await traceGasAccountStoreAsyncStep('ensure_service_ready', () =>
    ensureGasAccountServiceReady(),
  );

  const nextSession = measureGasAccountStoreSyncStep(
    'hydrate_loaded_service',
    () => hydrateSessionFromLoadedService(),
  );
  const discoveryState = measureGasAccountStoreSyncStep(
    'read_discovery_runtime',
    getDiscoveryStateFromRuntime,
  );

  measureGasAccountStoreSyncStep(
    'discovery_set_state',
    () => {
      gasAccountStore.setState(prev => ({
        ...prev,
        discovery: {
          ...prev.discovery,
          ...discoveryState,
        },
      }));
    },
    {
      hasPendingHardwareAccount: !!discoveryState.pendingHardwareAccount,
      accountsWithBalanceCount: discoveryState.accountsWithBalance.length,
    },
  );

  traceGasAccountStore('ensure_runtime_ready_end', {
    durationMs: Date.now() - startedAt,
    sessionStatus: nextSession.status,
    hasSig: !!nextSession.sig,
    hasAccountId: !!nextSession.accountId,
    hasPendingHardwareAccount: !!discoveryState.pendingHardwareAccount,
    accountsWithBalanceCount: discoveryState.accountsWithBalance.length,
  });

  return nextSession;
});

const hydrateSessionFromService = ensureGasAccountRuntimeReady;

let latestSnapshotRefreshRequestId = 0;
const createSnapshotRefreshRequestId = () => {
  latestSnapshotRefreshRequestId += 1;
  return latestSnapshotRefreshRequestId;
};
const isLatestSnapshotRefreshRequest = (requestId: number) =>
  requestId === latestSnapshotRefreshRequestId;

const triggerReLoginAfterInvalidSession = async () => {
  try {
    const { autoLoginGasAccountIfNeeded, resetAutoLoginFlag } = await import(
      '@/utils/autoLoginGasAccount'
    );
    resetAutoLoginFlag();
    await autoLoginGasAccountIfNeeded();
  } catch (error) {
    console.error(
      'autoLoginGasAccountIfNeeded after invalidateSession error',
      error,
    );
  }
};

const refreshSnapshot = async (options?: { reason?: string }) => {
  const reason = options?.reason || 'manual';
  const startedAt = Date.now();
  traceGasAccountStore('refresh_snapshot_start', { reason });

  await traceGasAccountStoreAsyncStep(
    'refresh_snapshot_ensure_runtime_ready',
    () => ensureGasAccountRuntimeReady(),
    { reason },
  );

  const requestId = createSnapshotRefreshRequestId();
  const { sig, accountId } = gasAccountStore.getState().session;

  if (!sig || !accountId) {
    traceGasAccountStore('refresh_snapshot_no_session', {
      reason,
      requestId,
    });
    measureGasAccountStoreSyncStep(
      'refresh_snapshot_clear_balance_state',
      () => {
        setGasAccountCurrentBalanceStateSync();
      },
      { reason, requestId },
    );
    return undefined;
  }

  measureGasAccountStoreSyncStep(
    'refresh_snapshot_set_refreshing',
    () => {
      gasAccountStore.setState(prev => startSnapshotRefreshState(prev, reason));
    },
    { reason, requestId },
  );

  try {
    const result = await traceGasAccountStoreAsyncStep(
      'refresh_snapshot_api',
      () => openapi.getGasAccountInfo({ sig, id: accountId }),
      { reason, requestId },
    );

    const latestSession = gasAccountStore.getState().session;

    if (
      !isLatestSnapshotRefreshRequest(requestId) ||
      latestSession.sig !== sig ||
      latestSession.accountId !== accountId
    ) {
      traceGasAccountStore('refresh_snapshot_stale_result', {
        reason,
        requestId,
      });
      return undefined;
    }

    if (result.account.id) {
      const hasBalance = Number(result.account.balance || 0) > 0;
      measureGasAccountStoreSyncStep(
        'refresh_snapshot_set_current_balance_state',
        () => {
          setGasAccountCurrentBalanceStateSync(accountId, hasBalance);
        },
        {
          reason,
          requestId,
          hasBalance,
        },
      );
      measureGasAccountStoreSyncStep(
        'refresh_snapshot_finish_set_state',
        () => {
          gasAccountStore.setState(prev =>
            finishSnapshotRefreshState(prev, result),
          );
        },
        {
          reason,
          requestId,
          hasBalance,
        },
      );
      traceGasAccountStore('refresh_snapshot_end', {
        reason,
        requestId,
        durationMs: Date.now() - startedAt,
        hasBalance,
      });
      return result;
    }

    traceGasAccountStore('refresh_snapshot_invalid_session', {
      reason,
      requestId,
      durationMs: Date.now() - startedAt,
    });
    storeApiGasAccount.invalidateSession({ recheckAccounts: true });
    return undefined;
  } catch (error: any) {
    const latestSession = gasAccountStore.getState().session;
    if (
      !isLatestSnapshotRefreshRequest(requestId) ||
      latestSession.sig !== sig ||
      latestSession.accountId !== accountId
    ) {
      traceGasAccountStore('refresh_snapshot_error_stale', {
        reason,
        requestId,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }

    measureGasAccountStoreSyncStep(
      'refresh_snapshot_fail_set_state',
      () => {
        gasAccountStore.setState(prev => failSnapshotRefreshState(prev));
      },
      {
        reason,
        requestId,
      },
    );
    if (error?.message?.includes?.('gas account verified failed')) {
      storeApiGasAccount.invalidateSession({ recheckAccounts: true });
      return undefined;
    }
    traceGasAccountStore('refresh_snapshot_error', {
      reason,
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

let latestHistoryRefreshRequestId = 0;
let isGasAccountHistoryRefreshEnabled = false;
const createHistoryRefreshRequestId = () => {
  latestHistoryRefreshRequestId += 1;
  return latestHistoryRefreshRequestId;
};
const isLatestHistoryRefreshRequest = (requestId: number) =>
  requestId === latestHistoryRefreshRequestId;
const isCurrentHistorySession = ({
  sig,
  accountId,
}: {
  sig?: string;
  accountId?: string;
}) => {
  const latestSession = gasAccountStore.getState().session;
  return latestSession.sig === sig && latestSession.accountId === accountId;
};

const refreshHistory = async (options?: { reason?: string }) => {
  const reason = options?.reason || 'manual';
  const startedAt = Date.now();
  traceGasAccountStore('refresh_history_start', { reason });

  if (!isGasAccountHistoryRefreshEnabled) {
    traceGasAccountStore('refresh_history_skip_disabled', {
      reason,
      durationMs: Date.now() - startedAt,
    });
    return undefined;
  }

  await traceGasAccountStoreAsyncStep(
    'refresh_history_ensure_runtime_ready',
    () => ensureGasAccountRuntimeReady(),
    { reason },
  );

  const requestId = createHistoryRefreshRequestId();
  const { sig, accountId } = gasAccountStore.getState().session;
  const prevHistory = gasAccountStore.getState().history;
  const hadPendingBeforeRefresh =
    prevHistory.rechargeList.length > 0 || prevHistory.withdrawList.length > 0;

  if (!sig || !accountId) {
    if (!isLatestHistoryRefreshRequest(requestId)) {
      traceGasAccountStore('refresh_history_no_session_stale', {
        reason,
        requestId,
      });
      return undefined;
    }
    measureGasAccountStoreSyncStep(
      'refresh_history_clear_set_state',
      () => {
        gasAccountStore.setState(prev =>
          finishHistoryRefreshState(prev, {
            list: [],
            rechargeList: [],
            withdrawList: [],
            totalCount: 0,
          }),
        );
      },
      {
        reason,
        requestId,
      },
    );
    traceGasAccountStore('refresh_history_no_session_end', {
      reason,
      requestId,
      durationMs: Date.now() - startedAt,
    });
    return undefined;
  }

  measureGasAccountStoreSyncStep(
    'refresh_history_set_refreshing',
    () => {
      gasAccountStore.setState(prev => startHistoryRefreshState(prev));
    },
    {
      reason,
      requestId,
      previousConfirmedCount: prevHistory.list.length,
      previousRechargeCount: prevHistory.rechargeList.length,
      previousWithdrawCount: prevHistory.withdrawList.length,
    },
  );

  try {
    const data = await traceGasAccountStoreAsyncStep(
      'refresh_history_api',
      () =>
        openapi.getGasAccountHistory({
          sig,
          account_id: accountId,
          start: 0,
          limit: 10,
        }),
      {
        reason,
        requestId,
      },
    );

    if (
      !isGasAccountHistoryRefreshEnabled ||
      !isLatestHistoryRefreshRequest(requestId) ||
      !isCurrentHistorySession({ sig, accountId })
    ) {
      traceGasAccountStore('refresh_history_stale_result', {
        reason,
        requestId,
      });
      return undefined;
    }

    const confirmedCount = data.history_list?.length || 0;
    const rechargeCount = data.recharge_list?.length || 0;
    const withdrawCount = data.withdraw_list?.length || 0;

    measureGasAccountStoreSyncStep(
      'refresh_history_finish_set_state',
      () => {
        gasAccountStore.setState(prev =>
          finishHistoryRefreshState(prev, {
            list: data.history_list || [],
            rechargeList: data.recharge_list || [],
            withdrawList: data.withdraw_list || [],
            totalCount: data.pagination.total,
          }),
        );
      },
      {
        reason,
        requestId,
        confirmedCount,
        rechargeCount,
        withdrawCount,
        totalCount: data.pagination.total,
      },
    );

    const hasPendingAfterRefresh = rechargeCount > 0 || withdrawCount > 0;

    if (hadPendingBeforeRefresh && !hasPendingAfterRefresh) {
      storeApiGasAccount
        .refreshSnapshot({ reason: 'pending_history_settled' })
        .catch(error => {
          console.error(
            'refreshSnapshot after pending history settled error',
            error,
          );
        });
    }

    traceGasAccountStore('refresh_history_end', {
      reason,
      requestId,
      durationMs: Date.now() - startedAt,
      confirmedCount,
      rechargeCount,
      withdrawCount,
      totalCount: data.pagination.total,
      hadPendingBeforeRefresh,
      hasPendingAfterRefresh,
    });

    return data;
  } catch (error) {
    if (
      !isGasAccountHistoryRefreshEnabled ||
      !isLatestHistoryRefreshRequest(requestId) ||
      !isCurrentHistorySession({ sig, accountId })
    ) {
      traceGasAccountStore('refresh_history_error_stale', {
        reason,
        requestId,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }

    measureGasAccountStoreSyncStep(
      'refresh_history_fail_set_state',
      () => {
        gasAccountStore.setState(prev => failHistoryRefreshState(prev));
      },
      {
        reason,
        requestId,
      },
    );
    traceGasAccountStore('refresh_history_error', {
      reason,
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

async function loadMoreHistory() {
  await ensureGasAccountRuntimeReady();
  const state = gasAccountStore.getState();
  const { sig, accountId } = state.session;
  const { history } = state;
  const hasLoadedAllHistory = history.totalCount <= history.list.length;

  if (
    !sig ||
    !accountId ||
    history.loadingMore ||
    history.status === 'refreshing' ||
    hasLoadedAllHistory
  ) {
    return;
  }

  gasAccountStore.setState(prev => ({
    ...prev,
    history: {
      ...prev.history,
      loadingMore: true,
    },
  }));

  try {
    const data = await openapi.getGasAccountHistory({
      sig,
      account_id: accountId,
      start: history.list.length,
      limit: 10,
    });

    if (!isCurrentHistorySession({ sig, accountId })) {
      return;
    }

    gasAccountStore.setState(prev => ({
      ...prev,
      history: {
        ...prev.history,
        list: [...prev.history.list, ...(data.history_list || [])],
        totalCount:
          (data.history_list?.length || 0) > 0
            ? data.pagination.total
            : prev.history.list.length,
        loadingMore: false,
        status: 'ready',
        lastFetchedAt: Date.now(),
      },
    }));

    const latestHistory = gasAccountStore.getState().history;
    const latestHistoryExhausted =
      latestHistory.totalCount <= latestHistory.list.length;

    if (latestHistoryExhausted) {
      storeApiGasAccount.refreshSnapshot().catch(error => {
        console.error(
          'refreshSnapshot after loadMoreHistory complete error',
          error,
        );
      });
    }
  } catch (error) {
    gasAccountStore.setState(prev => ({
      ...prev,
      history: {
        ...prev.history,
        loadingMore: false,
        status: 'error',
      },
    }));
    throw error;
  }
}

export const storeApiGasAccount = {
  async ensureRuntimeReady() {
    await ensureGasAccountRuntimeReady();
  },
  setGasAccount,
  getSession() {
    return gasAccountStore.getState().session;
  },
  hydrateSessionFromService,
  getPendingHardwareAccount() {
    return gasAccountStore.getState().discovery.pendingHardwareAccount;
  },
  fetchGasAccountInfo: refreshSnapshot,
  refreshSnapshot,
  markSnapshotDirty(reason: string) {
    gasAccountStore.setState(prev => markSnapshotDirtyState(prev, reason));
  },
  scheduleSnapshotRefresh(options?: { reason?: string; delay?: number }) {
    const run = () =>
      storeApiGasAccount.refreshSnapshot().catch(error => {
        console.error('scheduleSnapshotRefresh error', error);
      });
    if (options?.delay && options.delay > 0) {
      setTimeout(run, options.delay);
    } else {
      run();
    }
  },
  refreshHistory,
  setHistoryRefreshEnabled(enabled: boolean) {
    isGasAccountHistoryRefreshEnabled = enabled;
  },
  loadMoreHistory,
  invalidateSession(options?: { recheckAccounts?: boolean }) {
    setGasAccountSigSync();
    setGasAccountCurrentBalanceStateSync();
    gasAccountStore.setState(prev => invalidateSessionState(prev));
    if (options?.recheckAccounts) {
      triggerReLoginAfterInvalidSession();
    }
  },
  setLoginVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('loginVisible', valOrFunc);
  },
  setSwitchVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('switchVisible', valOrFunc);
  },
  setAccountsWithGasAccountBalance(accounts: GasAccountBalanceAccount[]) {
    setGasAccountAccountsWithBalanceSync(accounts);
    gasAccountStore.setState(prev =>
      updateDiscoveryState(prev, {
        accountsWithBalance: accounts,
        status: 'ready',
        lastFetchedAt: Date.now(),
      }),
    );
  },
  setPendingHardwareAccount(account?: GasAccountRuntimeAccount) {
    setGasAccountPendingHardwareAccountSync(account);
    gasAccountStore.setState(prev =>
      updateDiscoveryState(prev, {
        pendingHardwareAccount: account,
      }),
    );
  },
  clearPendingHardwareAccount() {
    clearGasAccountPendingHardwareAccountSync();
    gasAccountStore.setState(prev =>
      updateDiscoveryState(prev, {
        pendingHardwareAccount: undefined,
      }),
    );
  },

  loginGasAccount: async (selectAccount: Account) => {
    if (!selectAccount) {
      throw new Error('background.error.noCurrentAccount');
    }
    await ensureGasAccountRuntimeReady();
    gasAccountStore.setState(prev =>
      updateSessionState(prev, {
        status: 'logging_in',
      }),
    );
    console.debug('selectAccount', selectAccount);
    const { text } = await openapi.getGasAccountSignText(selectAccount.address);

    const noSignType =
      selectAccount.type === KEYRING_CLASS.PRIVATE_KEY ||
      selectAccount.type === KEYRING_CLASS.MNEMONIC;

    let signature = '';
    if (noSignType) {
      try {
        await ensureWalletUnlocked();
      } catch (error) {
        if (isWalletUnlockCancelled(error)) {
          gasAccountStore.setState(prev =>
            updateSessionState(prev, {
              status: 'idle',
            }),
          );
          return '';
        }

        throw error;
      }

      const { txHash } = await sendPersonalMessage({
        data: [text, selectAccount.address],
        account: selectAccount,
      });
      signature = txHash;
    } else {
      signature = await sendRequest<string>({
        data: {
          method: 'personal_sign',
          params: [text, selectAccount.address],
        },
        session: INTERNAL_REQUEST_SESSION,
        account: selectAccount,
      });
    }
    if (signature) {
      const result = await pRetry(
        async () =>
          openapi.loginGasAccount({
            sig: signature,
            account_id: selectAccount.address,
          }),
        {
          retries: 2,
        },
      );

      if (result?.success) {
        handleGasAccountLoginSuccess(signature, selectAccount);
        storeApiGasAccount.setGasAccount(signature, selectAccount);
        setGasAccountHasClaimedGiftSync(true);
        storeApiGasAccount.clearPendingHardwareAccount();
        storeApiGasAccount.markSnapshotDirty('login');
      } else {
        gasAccountStore.setState(prev =>
          updateSessionState(prev, {
            status: 'invalid',
          }),
        );
        throw new Error('Login failed');
      }
    }
    return signature;
  },
};
setGasAccountStoreApi(storeApiGasAccount);

export const storeApiGasAccountDeposit = {
  fetchBridgeSupportTokenList: fetchGasAccountBridgeSupportTokenList,
  getBridgeSupportTokenList() {
    return gasAccountDepositStore.getState().bridgeSupportTokenList;
  },
  getBridgeSupportUpdatedAt() {
    return gasAccountDepositStore.getState().bridgeSupportUpdatedAt;
  },
};

export const useGasAccountLoginVisible = () => {
  const isVisible = gasAccountStore(s => s.loginVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('loginVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};

export const useAccountsWithGasAccountBalance = () => {
  return gasAccountStore(s => s.discovery.accountsWithBalance);
};

export const usePendingHardwareAccount = () => {
  return gasAccountStore(s => s.discovery.pendingHardwareAccount);
};

export const useGasAccountBridgeSupportTokenList = () => {
  return gasAccountDepositStore(s => s.bridgeSupportTokenList);
};

export const useGasAccountBridgeSupportUpdatedAt = () => {
  return gasAccountDepositStore(s => s.bridgeSupportUpdatedAt);
};

export const useGasAccountBridgeSupportLoading = () => {
  return gasAccountDepositRuntimeStore(s => s.bridgeSupportLoading);
};

export const useGasAccountSwitchVisible = () => {
  const isVisible = gasAccountStore(s => s.switchVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('switchVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};
