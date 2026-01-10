import React, { useRef, useCallback, useEffect, useMemo } from 'react';

import {
  KeyringAccount,
  CORE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';

import {
  keyringService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { getAllAccounts, removeAddress } from '@/core/apis/address';
import { Account, IPinAddress } from '@/core/services/preference';
import { getWalletIcon } from '@/utils/walletInfo';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { filterMyAccounts } from '@/utils/account';
import { isEqual } from 'lodash';
import { updateHistoryTimeSingleAddress } from './historyTokenDict';
import { useCreationWithShallowCompare } from './common/useMemozied';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  accountEvents,
  fetchAllAccounts,
  KeyringAccountWithAlias,
} from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';
import { useBalanceAccounts } from './useAccountsBalance';
import { perfEvents } from '@/core/utils/perf';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';
import { InteractionManager } from 'react-native';

export type { KeyringAccountWithAlias as /** @deprecated */ KeyringAccountWithAlias };

type Store = {
  accounts: KeyringAccountWithAlias[];
  // fetchingAccounts: boolean;
  pinnedAddresses: IPinAddress[];
  currentAccount: KeyringAccountWithAlias | null;

  newlyAddedAccounts: Record<
    AccountInfoEntity['_db_id'],
    Awaited<ReturnType<typeof AccountInfoEntity.getAccountsAddedIn>>[0]
  >;
};
const zAccountStore = zCreate<Store>((set, get) => {
  return {
    accounts: [],
    // fetchingAccounts: false,

    pinnedAddresses: preferenceService.getPinAddresses(),
    currentAccount: null,

    newlyAddedAccounts: {},
  };
});

const fetchAndSet = makeAvoidParallelAsyncFunc(async () => {
  return fetchAllAccounts().then(accounts => {
    setAccounts(accounts);
  });
});

async function fetchNewlyAddedAccounts() {
  return AccountInfoEntity.getAccountsAddedIn(
    NEWLY_ADDED_ACCOUNT_DURATION,
  ).then(accounts => {
    zAccountStore.setState(prev => {
      const newVal = accounts.reduce((accu, cur) => {
        accu[cur._db_id] = cur;
        return accu;
      }, {} as Store['newlyAddedAccounts']);

      if (isEqual(prev.newlyAddedAccounts, newVal)) return prev;

      return {
        ...prev,
        newlyAddedAccounts: newVal,
      };
    });

    return accounts;
  });
}

export const NEWLY_ADDED_ACCOUNT_DURATION = 10 * 60 * 1000;

export function useIsNewlyAddedAccount(account: KeyringAccount) {
  const dbId = useMemo(() => {
    return EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
  }, [account.address, account.type, account.brandName]);
  const newlyAddedAccount = zAccountStore(
    s => s.newlyAddedAccounts[dbId] ?? null,
  );

  return {
    newlyAddedAccount,
    isNewlyAdded:
      !!newlyAddedAccount &&
      Date.now() - newlyAddedAccount.updated_at <= NEWLY_ADDED_ACCOUNT_DURATION,
  };
}

export function useDevNewlyAddedAccounts() {
  const newlyAddedAccounts = zAccountStore(s => s.newlyAddedAccounts);
  return {
    newlyAddedAccounts: useMemo(
      () => Object.values(newlyAddedAccounts),
      [newlyAddedAccounts],
    ),
  };
}

export function startManageAccountStoreLifecycle() {
  perfEvents.subscribe('USER_MANUALLY_UNLOCK', () => {
    fetchAndSet();
  });

  keyringService.on('newAccount', (account: Account) => {
    fetchAndSet();
  });
  // removedAccount
  keyringService.on('removedAccount', async (account: Account) => {
    fetchAndSet();

    accountEvents.emit('ACCOUNT_REMOVED', {
      removedAccounts: [account],
    });

    await AccountInfoEntity.deleteByAccount(account);
    await fetchNewlyAddedAccounts();
  });

  keyringService.store.subscribe(state => {
    if (state.booted && state.vault) {
      fetchAndSet();
    }
  });

  accountEvents.on('ACCOUNT_ADDED', async ({ accounts, scene }) => {
    await AccountInfoEntity.recordNewAccount(accounts);
    await fetchNewlyAddedAccounts();
  });

  ormEvents.on(`account_info:removed`, () => {
    fetchNewlyAddedAccounts();
  });

  fetchNewlyAddedAccounts();
  setInterval(() => {
    InteractionManager.runAfterInteractions(() => {
      fetchNewlyAddedAccounts();
    });
  }, 10 * 1e3);

  setInterval(() => {
    InteractionManager.runAfterInteractions(() => {
      AccountInfoEntity.trimExpiredAccounts(NEWLY_ADDED_ACCOUNT_DURATION);
    });
  }, 60 * 1e3);
}

// 简单打个补丁先避免 balance 和 evmBalance 变化触发 ACCOUNTS_MAYBE_CHANGED
// TODO: 彻底解决这个问题
const stripAccountsForDiff = (accounts: KeyringAccountWithAlias[]) =>
  accounts.map(account => {
    const { balance, evmBalance, ...rest } = account;
    return rest;
  });
function setAccounts(valOrFunc: UpdaterOrPartials<Store['accounts']>) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.accounts,
      valOrFunc,
      {
        strict: true,
      },
    );

    if (changed) {
      return { ...prev, accounts: newVal };
    }

    return prev;
  });
}

export function setCurrentAccount(
  valOrFunc: UpdaterOrPartials<Store['currentAccount']>,
) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.currentAccount,
      valOrFunc,
      { strict: true },
    );

    if (changed) {
      return { ...prev, currentAccount: newVal };
    }

    return prev;
  });
}
eventBus.on(EVENT_SWITCH_ACCOUNT, v => {
  setCurrentAccount(v);
});

function setPinAddresses(
  valOrFunc: UpdaterOrPartials<Store['pinnedAddresses']>,
) {
  zAccountStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.pinnedAddresses,
      valOrFunc,
    );

    if (changed) {
      return { ...prev, pinnedAddresses: newVal };
    }

    return prev;
  });
}

const doFetchAccounts = makeAvoidParallelAsyncFunc(async () => {
  const nextAccounts = await fetchAllAccounts();
  setAccounts(nextAccounts);

  return nextAccounts;
});

async function removeAccount(account: KeyringAccount) {
  const accounts = await getAllAccounts();

  togglePinAddressAsync({ ...account, nextPinned: false });
  await removeAddress(account);
  await doFetchAccounts();
  if (
    accounts.filter(acc => isSameAddress(acc.address, account.address))
      .length === 1
  ) {
    await deleteDBResourceForAddress(account.address);
    updateHistoryTimeSingleAddress(account.address, 0);
    transactionHistoryService.clearSuccessAndFailList(account.address);
  }
}

export function useAccounts(opts?: { disableAutoFetch?: boolean }) {
  const accounts = zAccountStore(s => s.accounts);

  const { disableAutoFetch = false } = opts || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      doFetchAccounts();
    }
  }, [disableAutoFetch]);

  const stableAccounts = useCreationWithShallowCompare(() => {
    return accounts;
  }, [accounts]);

  return {
    accounts: stableAccounts,
    fetchAccounts: doFetchAccounts,
  };
}

export const storeApiAccounts = {
  getAccounts() {
    return zAccountStore.getState().accounts;
  },
  getPinAddresses() {
    return zAccountStore.getState().pinnedAddresses;
  },
  fetchAccounts: doFetchAccounts,
  removeAccount,
};

export function useMyAccounts(opts?: { disableAutoFetch?: boolean }) {
  const allAccounts = zAccountStore(s => s.accounts);

  const { disableAutoFetch = false } = opts || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      doFetchAccounts();
    }
  }, [disableAutoFetch]);

  const accounts = useCreationWithShallowCompare(() => {
    return filterMyAccounts(allAccounts);
  }, [allAccounts]);

  return {
    accounts,
    fetchAccounts: doFetchAccounts,
  };
}

const togglePinAddressAsync = (payload: {
  brandName: Account['brandName'];
  address: Account['address'];
  nextPinned?: boolean;
}) => {
  const allPinAddresses = preferenceService.getPinAddresses();

  const {
    nextPinned = !allPinAddresses.some(
      highlighted =>
        isSameAddress(highlighted.address, payload.address) &&
        highlighted.brandName === payload.brandName,
    ),
  } = payload;

  const addresses = [...allPinAddresses];
  const newItem = {
    brandName: payload.brandName,
    address: payload.address,
  };
  if (nextPinned) {
    addresses.unshift(newItem);
    preferenceService.updatePinAddresses(addresses);
    matomoRequestEvent({
      category: 'Pin Address',
      action: 'PinAddress_Finish',
    });
  } else {
    const toggleIdx = addresses.findIndex(
      addr =>
        addr.brandName === payload.brandName &&
        isSameAddress(addr.address, payload.address),
    );
    if (toggleIdx > -1) {
      addresses.splice(toggleIdx, 1);
    }
    preferenceService.updatePinAddresses(addresses);
  }
  setPinAddresses(addresses);
};

export const usePinAddresses = (opts?: { disableAutoFetch?: boolean }) => {
  const { disableAutoFetch = false } = opts || {};
  const pinAddresses = zAccountStore(s => s.pinnedAddresses);

  /**
   * @deprecated
   */
  const getPinAddresses = useCallback(() => {
    const addresses = preferenceService.getPinAddresses();
    setPinAddresses(addresses);
  }, []);

  const getPinAddressesAsync = useCallback(async () => {
    return getPinAddresses();
  }, [getPinAddresses]);

  useEffect(() => {
    if (!disableAutoFetch) {
      getPinAddressesAsync();
    }
  }, [disableAutoFetch, getPinAddressesAsync]);

  return {
    pinAddresses,
    getPinAddressesAsync,
    togglePinAddressAsync,
  };
};

export const usePinnedAccountList = () => {
  const pinAddresses = zAccountStore(s => s.pinnedAddresses);
  const accounts = zAccountStore(s => s.accounts);
  const { balanceAccounts } = useBalanceAccounts();

  const pinnedAccountList = useMemo(() => {
    const res: KeyringAccountWithAlias[] = [];
    pinAddresses?.forEach(pinAddr => {
      const item = accounts.find(account => {
        return (
          isSameAddress(pinAddr.address, account.address) &&
          account.brandName === pinAddr.brandName
        );
      });
      if (
        item &&
        ![
          KEYRING_TYPE.GnosisKeyring,
          KEYRING_TYPE.WatchAddressKeyring,
          KEYRING_TYPE.WalletConnectKeyring,
        ].includes(item.type)
      ) {
        const account = balanceAccounts[item.address.toLowerCase()];
        res.push({
          ...item,
          balance: account?.balance || item.balance || 0,
          evmBalance: account?.evmBalance || item.evmBalance || 0,
        });
      }
    });
    return res;
  }, [accounts, balanceAccounts, pinAddresses]);

  return pinnedAccountList;
};

/**
 * @deprecated use `removeAccount` directly
 */
export function useRemoveAccount() {
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { togglePinAddressAsync } = usePinAddresses({ disableAutoFetch: true });
  return useCallback(
    async (account: KeyringAccount) => {
      togglePinAddressAsync({ ...account, nextPinned: false });
      await removeAddress(account);
      await fetchAccounts();
      if (
        accounts.filter(acc => isSameAddress(acc.address, account.address))
          .length === 1
      ) {
        await deleteDBResourceForAddress(account.address);
        updateHistoryTimeSingleAddress(account.address, 0);
        transactionHistoryService.clearSuccessAndFailList(account.address);
      }
    },
    [accounts, fetchAccounts, togglePinAddressAsync],
  );
}

export function useWalletBrandLogo<T extends string>(brandName?: T) {
  const RcWalletIcon = useMemo(() => {
    return getWalletIcon(brandName);
  }, [brandName]) as T extends void
    ? null
    : React.FC<import('react-native-svg').SvgProps>;

  return {
    RcWalletIcon,
  };
}
