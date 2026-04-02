export type GasAccountSessionAccount = {
  address: string;
  type: string;
  brandName: string;
};

export type GasAccountBalanceAccount = GasAccountSessionAccount;

export type GasAccountSessionStatus =
  | 'idle'
  | 'logging_in'
  | 'logged_in'
  | 'invalid';

export type GasAccountResourceStatus =
  | 'idle'
  | 'refreshing'
  | 'ready'
  | 'error';

export type GasAccountSessionState = {
  sig?: string;
  accountId?: string;
  account?: GasAccountSessionAccount;
  status: GasAccountSessionStatus;
};

export type GasAccountSnapshotState<TAccountInfo = unknown> = {
  accountInfo?: TAccountInfo;
  status: GasAccountResourceStatus;
  dirty: boolean;
  refreshReason?: string;
  lastFetchedAt?: number;
};

export type GasAccountHistoryState<
  THistoryItem = unknown,
  TPendingItem = unknown,
> = {
  list: THistoryItem[];
  rechargeList: TPendingItem[];
  withdrawList: TPendingItem[];
  totalCount: number;
  status: GasAccountResourceStatus;
  lastFetchedAt?: number;
  refreshReason?: string;
  loadingMore?: boolean;
};

export type GasAccountDiscoveryState = {
  pendingHardwareAccount?: GasAccountSessionAccount;
  accountsWithBalance: GasAccountBalanceAccount[];
  status: GasAccountResourceStatus;
  lastFetchedAt?: number;
};

export type GasAccountState<
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
> = {
  session: GasAccountSessionState;
  snapshot: GasAccountSnapshotState<TAccountInfo>;
  history: GasAccountHistoryState<THistoryItem, TPendingItem>;
  discovery: GasAccountDiscoveryState;
  loginVisible: boolean;
  switchVisible: boolean;
};

export const createInitialGasAccountState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  partials?: Partial<GasAccountState<TAccountInfo, THistoryItem, TPendingItem>>,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  session: {
    status: 'idle',
    ...partials?.session,
  },
  snapshot: {
    status: 'idle',
    dirty: false,
    ...partials?.snapshot,
  },
  history: {
    list: [],
    rechargeList: [],
    withdrawList: [],
    totalCount: 0,
    status: 'idle',
    loadingMore: false,
    ...partials?.history,
  },
  discovery: {
    accountsWithBalance: [],
    status: 'idle',
    ...partials?.discovery,
  },
  loginVisible: partials?.loginVisible || false,
  switchVisible: partials?.switchVisible || false,
});

export const updateSessionState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  session: Partial<GasAccountSessionState>,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  session: {
    ...state.session,
    ...session,
  },
});

export const invalidateSessionState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  session: {
    status: 'invalid',
  },
  snapshot: {
    status: 'idle',
    dirty: false,
  },
  history: {
    list: [],
    rechargeList: [],
    withdrawList: [],
    totalCount: 0,
    status: 'idle',
    loadingMore: false,
  },
});

export const updateDiscoveryState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  discovery: Partial<GasAccountDiscoveryState>,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  discovery: {
    ...state.discovery,
    ...discovery,
  },
});

export const markSnapshotDirtyState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  reason: string,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  snapshot: {
    ...state.snapshot,
    dirty: true,
    refreshReason: reason,
  },
});

export const startSnapshotRefreshState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  reason: string,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  snapshot: {
    ...state.snapshot,
    status: 'refreshing',
    dirty: true,
    refreshReason: reason,
  },
});

export const finishSnapshotRefreshState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  accountInfo?: TAccountInfo,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  snapshot: {
    ...state.snapshot,
    accountInfo,
    status: 'ready',
    dirty: false,
    lastFetchedAt: Date.now(),
  },
});

export const failSnapshotRefreshState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  snapshot: {
    ...state.snapshot,
    status: 'error',
  },
});

export const startHistoryRefreshState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  reason?: string,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  history: {
    ...state.history,
    status: 'refreshing',
    refreshReason: reason,
  },
});

export const finishHistoryRefreshState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
  history: Pick<
    GasAccountHistoryState<THistoryItem, TPendingItem>,
    'list' | 'rechargeList' | 'withdrawList' | 'totalCount'
  >,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  history: {
    ...state.history,
    ...history,
    status: 'ready',
    loadingMore: false,
    lastFetchedAt: Date.now(),
  },
});

export const failHistoryRefreshState = <
  TAccountInfo = unknown,
  THistoryItem = unknown,
  TPendingItem = unknown,
>(
  state: GasAccountState<TAccountInfo, THistoryItem, TPendingItem>,
): GasAccountState<TAccountInfo, THistoryItem, TPendingItem> => ({
  ...state,
  history: {
    ...state.history,
    status: 'error',
    loadingMore: false,
  },
});
