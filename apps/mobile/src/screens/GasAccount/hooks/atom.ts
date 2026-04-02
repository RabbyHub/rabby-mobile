import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import {
  gasAccountService,
  keyringService,
  perpsService,
} from '@/core/services';
import {
  GasAccountRuntimeAccount,
  GasAccountServiceStore,
} from '@/core/services/gasAccount';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { eventBus, EVENTS } from '@/utils/events';
import { handleGasAccountLoginSuccess } from '@/utils/gasAccountAnalytics';
import { sendPersonalMessage } from '@/utils/sendPersonalMessage';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { GasAccountBridgeToken } from '@rabby-wallet/rabby-api/dist/types';
import { KeyringEventAccount } from '@rabby-wallet/service-keyring';
import pRetry from 'p-retry';
import { useCallback } from 'react';
import {
  createInitialGasAccountState,
  failHistoryRefreshState,
  failSnapshotRefreshState,
  finishHistoryRefreshState,
  finishSnapshotRefreshState,
  GasAccountBalanceAccount,
  GasAccountSessionAccount,
  GasAccountState,
  invalidateSessionState,
  markSnapshotDirtyState,
  startHistoryRefreshState,
  startSnapshotRefreshState,
  updateDiscoveryState,
  updateSessionState,
} from './state';

// const refreshGasBalanceAtom = atom(0);
// const refreshgasAccountHistoryAtom = atom(0);
// export const gasAccountSigAtom = atom<Partial<GasAccountServiceStore>>({});
// gasAccountSigAtom.onMount = set => {
//   const data = gasAccountService.getGasAccountData() as GasAccountServiceStore;
//   set({
//     ...data,
//   });
//   eventBus.on(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, () => {
//     const data =
//       gasAccountService.getGasAccountData() as GasAccountServiceStore;
//     set({
//       ...data,
//     });
//   });
// };
// const logoutVisibleAtom = atom(false);
// const loginVisibleAtom = atom(false);
// const switchVisibleAtom = atom(false);

runIIFEFunc(() => {
  eventBus.on(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, () => {
    gasAccountStore.setState({
      session: getSessionStateFromService(),
      discovery: {
        ...gasAccountStore.getState().discovery,
        ...getDiscoveryStateFromRuntime(),
      },
    });
  });
  eventBus.on(EVENTS.TX_COMPLETED, () => {
    storeApiGasAccount.scheduleSnapshotRefresh({
      reason: 'tx_completed',
    });
  });
});

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

const getSessionStateFromService = () => {
  const data = gasAccountService.getGasAccountData() as GasAccountServiceStore;
  const hasSession = !!data.sig && !!data.accountId;

  return {
    sig: data.sig,
    accountId: data.accountId,
    account: data.account as GasAccountSessionAccount | undefined,
    status: hasSession ? ('logged_in' as const) : ('idle' as const),
  };
};

const getDiscoveryStateFromRuntime = () => ({
  pendingHardwareAccount: gasAccountService.getPendingHardwareAccount() as
    | GasAccountRuntimeAccount
    | undefined,
  accountsWithBalance:
    gasAccountService.getAccountsWithGasAccountBalance() as GasAccountBalanceAccount[],
  status: 'idle' as const,
});

function setVisibleFor(
  key: keyof GasAccountVisibleState,
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  gasAccountStore.setState(prev => {
    const newVal = resolveValFromUpdater(prev[key] || false, valOrFunc).newVal;

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
    session: getSessionStateFromService(),
    discovery: getDiscoveryStateFromRuntime(),
  }),
  loginVisible: false,
  switchVisible: false,
}));

type GasAccountDepositState = {
  bridgeSupportTokenList: GasAccountBridgeSupportTokenList;
  bridgeSupportUpdatedAt: number;
  bridgeSupportLoading: boolean;
};

const EMPTY_GAS_ACCOUNT_BRIDGE_SUPPORT_TOKEN_LIST: GasAccountBridgeSupportTokenList =
  {
    hyperliquid_tokens: [],
    wallet_tokens: [],
  };
const GAS_ACCOUNT_BRIDGE_SUPPORT_CACHE_TTL = 60 * 1000;
const gasAccountDepositOpenapi =
  openapi as OpenApiWithGasAccountBridgeSupportTokenList;

export const gasAccountDepositStore = zCreate<GasAccountDepositState>(() => ({
  bridgeSupportTokenList: EMPTY_GAS_ACCOUNT_BRIDGE_SUPPORT_TOKEN_LIST,
  bridgeSupportUpdatedAt: 0,
  bridgeSupportLoading: false,
}));

const fetchGasAccountBridgeSupportTokenList = makeAvoidParallelAsyncFunc(
  async (force = false) => {
    const { bridgeSupportTokenList, bridgeSupportUpdatedAt } =
      gasAccountDepositStore.getState();
    const now = Date.now();
    const isFresh =
      bridgeSupportUpdatedAt > 0 &&
      now - bridgeSupportUpdatedAt < GAS_ACCOUNT_BRIDGE_SUPPORT_CACHE_TTL;

    if (!force && isFresh) {
      return bridgeSupportTokenList;
    }

    gasAccountDepositStore.setState({ bridgeSupportLoading: true });
    try {
      const result =
        (await gasAccountDepositOpenapi.getGasAccountBridgeSupportTokenList?.()) ||
        EMPTY_GAS_ACCOUNT_BRIDGE_SUPPORT_TOKEN_LIST;
      const normalized: GasAccountBridgeSupportTokenList = {
        hyperliquid_tokens: result.hyperliquid_tokens || [],
        wallet_tokens: result.wallet_tokens || [],
      };

      gasAccountDepositStore.setState({
        bridgeSupportTokenList: normalized,
        bridgeSupportUpdatedAt: Date.now(),
      });

      return normalized;
    } finally {
      gasAccountDepositStore.setState({ bridgeSupportLoading: false });
    }
  },
);

const cleanupGasAccountAfterDeletedAddress = async (address: string) => {
  const restAddresses = await keyringService.getAllAddresses();
  const gasAccount =
    gasAccountService.getGasAccountData() as GasAccountServiceStore;
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
      gasAccountService.setGasAccountSig();
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
    // cleanupGasAccountAfterDeletedAddress(address);
    const perpsAccount = await perpsService.getCurrentAccount();
    if (
      isSameAddress(perpsAccount?.address || '', address) &&
      perpsAccount?.type === type
    ) {
      eventBus.emit(EVENTS.PERPS.LOG_OUT, perpsAccount);
      perpsService.setCurrentAccount(null);
    }
  }
};
keyringService.on('removedAccount', syncDeleteGasAccount);

export const useGasAccountSign = () => {
  return gasAccountStore(s => s.session) || {};
};

const setGasAccount = (
  sig?: string,
  account?: GasAccountServiceStore['account'],
) => {
  gasAccountService.setGasAccountSig(sig, account);
  if (!sig || !account) {
    gasAccountService.setCurrentBalanceState();
    gasAccountStore.setState(prev => invalidateSessionState(prev));
    return;
  }

  gasAccountStore.setState(prev =>
    updateSessionState(prev, {
      sig,
      accountId: account.address,
      account: account as GasAccountSessionAccount,
      status: 'logged_in',
    }),
  );
};

let scheduledSnapshotRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const SNAPSHOT_REFRESH_DELAY = 1200;

const refreshSnapshot = makeAvoidParallelAsyncFunc(
  async ({
    reason = 'manual',
  }: {
    reason?: string;
    force?: boolean;
  } = {}) => {
    const { sig, accountId } = gasAccountStore.getState().session;

    if (!sig || !accountId) {
      gasAccountService.setCurrentBalanceState();
      return undefined;
    }

    gasAccountStore.setState(prev => startSnapshotRefreshState(prev, reason));

    try {
      const result = await openapi.getGasAccountInfo({ sig, id: accountId });
      if (result.account.id) {
        gasAccountService.setCurrentBalanceState(
          accountId,
          Number(result.account.balance || 0) > 0,
        );
        gasAccountStore.setState(prev =>
          finishSnapshotRefreshState(prev, result),
        );
        return result;
      }

      storeApiGasAccount.invalidateSession();
      return undefined;
    } catch (error: any) {
      gasAccountStore.setState(prev => failSnapshotRefreshState(prev));
      if (error?.message?.includes?.('gas account verified failed')) {
        storeApiGasAccount.invalidateSession();
        return undefined;
      }
      throw error;
    }
  },
);

const refreshHistory = makeAvoidParallelAsyncFunc(async (reason = 'manual') => {
  const { sig, accountId } = gasAccountStore.getState().session;

  if (!sig || !accountId) {
    gasAccountStore.setState(prev =>
      finishHistoryRefreshState(prev, {
        list: [],
        rechargeList: [],
        withdrawList: [],
        totalCount: 0,
      }),
    );
    return undefined;
  }

  gasAccountStore.setState(prev => startHistoryRefreshState(prev, reason));

  try {
    const data = await openapi.getGasAccountHistory({
      sig,
      account_id: accountId,
      start: 0,
      limit: 10,
    });

    gasAccountStore.setState(prev =>
      finishHistoryRefreshState(prev, {
        list: data.history_list || [],
        rechargeList: data.recharge_list || [],
        withdrawList: data.withdraw_list || [],
        totalCount: data.pagination.total,
      }),
    );

    return data;
  } catch (error) {
    gasAccountStore.setState(prev => failHistoryRefreshState(prev));
    throw error;
  }
});

async function loadMoreHistory() {
  const state = gasAccountStore.getState();
  const { sig, accountId } = state.session;
  const { history } = state;

  if (
    !sig ||
    !accountId ||
    history.loadingMore ||
    history.status === 'refreshing' ||
    history.totalCount <=
      history.list.length +
        history.rechargeList.length +
        history.withdrawList.length
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
      start: history.list.length > 1 ? history.list.length : 0,
      limit: 10,
    });

    gasAccountStore.setState(prev => ({
      ...prev,
      history: {
        ...prev.history,
        list: [...prev.history.list, ...(data.history_list || [])],
        totalCount: data.pagination.total,
        loadingMore: false,
        status: 'ready',
        lastFetchedAt: Date.now(),
      },
    }));
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
  setGasAccount,
  getSigState() {
    return gasAccountStore.getState().session;
  },
  getSession() {
    return gasAccountStore.getState().session;
  },
  getPendingHardwareAccount() {
    return gasAccountStore.getState().discovery.pendingHardwareAccount;
  },
  fetchGasAccountInfo: refreshSnapshot,
  refreshSnapshot,
  markSnapshotDirty(reason: string) {
    gasAccountStore.setState(prev => markSnapshotDirtyState(prev, reason));
  },
  scheduleSnapshotRefresh({
    reason = 'scheduled',
    delay = SNAPSHOT_REFRESH_DELAY,
  }: {
    reason?: string;
    delay?: number;
  } = {}) {
    storeApiGasAccount.markSnapshotDirty(reason);
    if (scheduledSnapshotRefreshTimer) {
      return;
    }
    scheduledSnapshotRefreshTimer = setTimeout(() => {
      scheduledSnapshotRefreshTimer = null;
      const snapshot = gasAccountStore.getState().snapshot;
      if (!snapshot.dirty) {
        return;
      }
      storeApiGasAccount
        .refreshSnapshot({
          reason: snapshot.refreshReason || reason,
          force: true,
        })
        .catch(error => {
          console.error('scheduleSnapshotRefresh error', error);
        });
    }, delay);
  },
  refreshHistory,
  loadMoreHistory,
  invalidateSession() {
    gasAccountService.setGasAccountSig();
    gasAccountService.setCurrentBalanceState();
    gasAccountStore.setState(prev => invalidateSessionState(prev));
  },
  setLoginVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('loginVisible', valOrFunc);
  },
  setSwitchVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('switchVisible', valOrFunc);
  },
  setAccountsWithGasAccountBalance(accounts: GasAccountBalanceAccount[]) {
    gasAccountService.setAccountsWithGasAccountBalance(accounts);
    gasAccountStore.setState(prev =>
      updateDiscoveryState(prev, {
        accountsWithBalance: accounts,
        status: 'ready',
        lastFetchedAt: Date.now(),
      }),
    );
  },
  setPendingHardwareAccount(account?: GasAccountRuntimeAccount) {
    gasAccountService.setPendingHardwareAccount(account);
    gasAccountStore.setState(prev =>
      updateDiscoveryState(prev, {
        pendingHardwareAccount: account,
      }),
    );
  },
  clearPendingHardwareAccount() {
    gasAccountService.clearPendingHardwareAccount();
    gasAccountStore.setState(prev =>
      updateDiscoveryState(prev, {
        pendingHardwareAccount: undefined,
      }),
    );
  },

  loginGasAccount: async (selectAccount: Account) => {
    const account = selectAccount;
    if (!account) {
      throw new Error('background.error.noCurrentAccount');
    }
    gasAccountStore.setState(prev =>
      updateSessionState(prev, {
        status: 'logging_in',
      }),
    );
    console.debug('selectAccount', account);
    const { text } = await openapi.getGasAccountSignText(account.address);

    const noSignType =
      account?.type === KEYRING_CLASS.PRIVATE_KEY ||
      account?.type === KEYRING_CLASS.MNEMONIC;

    let signature = '';
    if (noSignType) {
      const { txHash } = await sendPersonalMessage({
        data: [text, account.address],
        account: account,
      });
      signature = txHash;
    } else {
      signature = await sendRequest<string>({
        data: {
          method: 'personal_sign',
          params: [text, account.address],
        },
        session: INTERNAL_REQUEST_SESSION,
        account,
      });
    }
    console.log(signature);
    if (signature) {
      const result = await pRetry(
        async () =>
          openapi.loginGasAccount({
            sig: signature,
            account_id: account.address,
          }),
        {
          retries: 2,
        },
      );

      if (result?.success) {
        handleGasAccountLoginSuccess(signature, account);
        storeApiGasAccount.setGasAccount(signature, account);
        gasAccountService.setHasClaimedGift(true);
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

export const useGasAccountBridgeSupportLoading = () => {
  return gasAccountDepositStore(s => s.bridgeSupportLoading);
};

export const useGasAccountSwitchVisible = () => {
  const isVisible = gasAccountStore(s => s.switchVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('switchVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};
