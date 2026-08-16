import {
  accountEvents,
  isDirectlySignableAccount,
  isHardwareAccount,
} from '@/core/apis/account';
import { openapi } from '@/core/request';
import { perfEvents } from '@/core/utils/perf';
import {
  KeyringAccountWithAlias,
  storeApiAccounts,
  useAccounts,
} from '@/hooks/account';
import { useHomeAssetSelectionSettings } from '@/hooks/appSettings';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import addressBalanceStore, { balanceAccountsStore } from '@/store/balance';
import {
  pickHomeAccountSelectionFromAddresses,
  pickHomeAccountSelectionFromSortedAccounts,
} from '@/store/homePortfolio/accountSelection';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useAppChainStore from '@/store/appchain';

export const isTabsSwiping = {
  value: false,
};

const EMPTY_SELECTED_ADDRESSES: string[] = [];

export function useAccountInfo() {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });
  const {
    topN,
    includeWatchAddresses,
    isExperimentEnabled: isHomeAssetSelectionExperimentEnabled,
  } = useHomeAssetSelectionSettings();
  const selectedAddresses = balanceAccountsStore(state =>
    isHomeAssetSelectionExperimentEnabled
      ? state.selectedAddresses
      : EMPTY_SELECTED_ADDRESSES,
  );
  const hasResolvedSelection = balanceAccountsStore(state =>
    isHomeAssetSelectionExperimentEnabled ? state.hasResolvedSelection : false,
  );

  const myAccounts = useCreationWithShallowCompare(
    () => filterMyAccounts(accounts),
    [accounts],
  );

  const sortedList = useSortAddressList(
    includeWatchAddresses ? accounts : myAccounts,
  );
  const {
    myTop10Accounts,
    myTop10Addresses,
    myTop10Records,
    myNotTop10Accounts,
  } = useCreationWithShallowCompare(() => {
    const selection =
      isHomeAssetSelectionExperimentEnabled && hasResolvedSelection
        ? pickHomeAccountSelectionFromAddresses(sortedList, selectedAddresses)
        : pickHomeAccountSelectionFromSortedAccounts(sortedList, {
            topN,
            uniqueAddresses: isHomeAssetSelectionExperimentEnabled,
          });

    return {
      myTop10Accounts: selection.selectedAccounts,
      myTop10Addresses: selection.selectedAddresses,
      myTop10Records: selection.selectedAddressRecords,
      myNotTop10Accounts: selection.restAccounts,
    };
  }, [
    hasResolvedSelection,
    isHomeAssetSelectionExperimentEnabled,
    topN,
    selectedAddresses,
    sortedList,
  ]);

  const stableTop10Addresses = useCreationWithShallowCompare(
    () => myTop10Addresses,
    myTop10Addresses,
  );

  const { hasWatchAddress, hasSafeAddress, gnosisAccounts, watchAccounts } =
    useCreationWithShallowCompare(() => {
      const ret = {
        hasWatchAddress: false,
        hasSafeAddress: false,
        gnosisAccounts: [] as KeyringAccountWithAlias[],
        watchAccounts: [] as KeyringAccountWithAlias[],
      };

      accounts.forEach(account => {
        if (account.type === KEYRING_CLASS.WATCH) {
          ret.hasWatchAddress = true;
          ret.watchAccounts.push(account);
        } else if (account.type === KEYRING_CLASS.GNOSIS) {
          ret.hasSafeAddress = true;
          ret.gnosisAccounts.push(account);
        }
      });

      return ret;
    }, [accounts]);

  const notMatteredAccounts = useCreationWithShallowCompare(() => {
    if (includeWatchAddresses) {
      return myNotTop10Accounts;
    }
    return [...myNotTop10Accounts, ...gnosisAccounts, ...watchAccounts];
  }, [
    includeWatchAddresses,
    myNotTop10Accounts,
    gnosisAccounts,
    watchAccounts,
  ]);

  return {
    myTop10Accounts,
    myTop10Addresses: stableTop10Addresses,
    myTop10Records,
    myNotTop10Accounts,
    notMatteredAccounts,
    gnosisAccounts,
    watchAccounts,
    list: sortedList,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
    rawAllAccounts: accounts,
    matteredAccountCount: includeWatchAddresses
      ? sortedList.length
      : filterMyAccounts(sortedList).length,
  };
}

function isAccountToShowReceiveTip(account: KeyringAccountWithAlias) {
  return isDirectlySignableAccount(account) || isHardwareAccount(account);
}

export async function getShowReceiveAddressTip(options?: {
  caredAccount?: KeyringAccountWithAlias | null;
  isForSingle?: boolean;
}) {
  const { caredAccount, isForSingle = false } = options || {};

  if (!caredAccount && isForSingle) {
    throw new Error('caredAccount is required when isForSingle is true');
  }

  let targetAccount = caredAccount;
  if (!isForSingle) {
    const myAccounts = await storeApiAccounts
      .fetchAccounts()
      .then(accounts => filterMyAccounts(accounts));
    const accountsToCheck = myAccounts.filter(account =>
      isAccountToShowReceiveTip(account),
    );
    if (accountsToCheck.length !== 1) return null;

    targetAccount = accountsToCheck[0];
  }

  if (!targetAccount) return null;
  if (!isAccountToShowReceiveTip(targetAccount)) return null;

  const evmBalance =
    addressBalanceStore.getAddressValue(targetAccount.address)?.evmBalance ??
    targetAccount.evmBalance ??
    0;

  const appChains = await useAppChainStore
    .getState()
    .getAppChains(targetAccount.address);
  const appChainHasBalance =
    !!appChains &&
    appChains.some(chain =>
      typeof chain.netWorth === 'number'
        ? chain.netWorth > 0
        : !!chain.netWorth,
    );

  let borned = true;
  try {
    const addressDesc = await openapi.addrDesc(targetAccount.address);
    borned = addressDesc.desc.born_at != null;
  } catch (error) {
    console.warn('Failed to fetch address desc', error);
  }

  return {
    targetAccount,
    evmBalance,
    appChainHasBalance,
    borned,
  };
}

export function useAccountHomeShowReceiveTip(
  caredAccount?: KeyringAccountWithAlias | null,
) {
  const isForSingle = !!caredAccount;
  const [asyncResult, detect] = useAsyncFn(
    () => getShowReceiveAddressTip({ caredAccount, isForSingle }),
    [caredAccount, isForSingle],
  );

  if (asyncResult.error) {
    console.error('Failed to get show receive address tip', asyncResult.error);
  }

  const targetAccount = asyncResult.loading
    ? null
    : asyncResult.value?.targetAccount || null;
  const accountToShowReceiveTip =
    !!targetAccount &&
    asyncResult.value?.evmBalance === 0 &&
    !asyncResult.value?.borned &&
    !asyncResult.value?.appChainHasBalance
      ? targetAccount
      : null;

  useEffect(() => {
    detect();
  }, [detect]);

  useEffect(() => {
    if (isForSingle) return;

    const onTxCompleted: EventBusListeners[typeof EVENTS.TX_COMPLETED] = () => {
      detect();
    };
    eventBus.addListener(EVENTS.TX_COMPLETED, onTxCompleted);

    const sub = perfEvents.subscribe('HOME_WILL_BE_REFRESHED_MANUALLY', () => {
      detect();
    });

    // const timer = setInterval(() => {
    //   detect();
    // }, 5 * 60 * 1000); // every 5 minutes

    return () => {
      eventBus.removeListener(EVENTS.TX_COMPLETED, onTxCompleted);
      sub.remove();
      // clearInterval(timer);
    };
  }, [isForSingle, detect]);

  useEffect(() => {
    if (isForSingle) return;

    const onAccountsChanged = () => {
      detect();
    };
    const subAdd = accountEvents.subscribe('ACCOUNT_ADDED', onAccountsChanged);
    const subRemove = accountEvents.subscribe(
      'ACCOUNT_REMOVED',
      onAccountsChanged,
    );

    return () => {
      subAdd.remove();
      subRemove.remove();
    };
  }, [isForSingle, detect]);

  return {
    targetAccount,
    isLoadingAccountToShowReceiveTip: asyncResult.loading,
    accountToShowReceiveTip:
      accountToShowReceiveTip &&
      isAccountToShowReceiveTip(accountToShowReceiveTip)
        ? accountToShowReceiveTip
        : null,
  };
}
