import {
  accountEvents,
  filterDirectlySignableAccounts,
  filterOutTop10Accounts,
  isDirectlySignableAccount,
  isHardwareAccount,
} from '@/core/apis/account';
import { openapi } from '@/core/request';
import { perfEvents } from '@/core/utils/perf';
import {
  KeyringAccountWithAlias,
  storeApiAccounts,
  useAccounts,
  useMyAccounts,
} from '@/hooks/account';
import {
  useCreationWithDeepCompare,
  useCreationWithShallowCompare,
} from '@/hooks/common/useMemozied';
import { apisAccountsBalance } from '@/hooks/useAccountsBalance';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';
import useAsyncFn from 'react-use/lib/useAsyncFn';

export const isTabsSwiping = {
  value: false,
};

export function useAccountInfo() {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });

  const myAccounts = useCreationWithShallowCompare(
    () => filterMyAccounts(accounts),
    [accounts],
  );

  const sortedList = useSortAddressList(myAccounts);
  const {
    myTop10Accounts,
    myTop10Addresses,
    myTop10Records,
    myNotTop10Accounts,
  } = useCreationWithShallowCompare(() => {
    const {
      top10Accounts: myTop10Accounts,
      top10Addresses: myTop10Addresses,
      top10Records: myTop10Records,
      restAccounts: myNotTop10Accounts,
    } = filterOutTop10Accounts(sortedList, { gatherSameAddress: false });

    return {
      myTop10Accounts,
      myTop10Addresses,
      myTop10Records,
      myNotTop10Accounts,
    };
  }, [sortedList]);

  const stableTop10Addresses = useCreationWithShallowCompare(
    () => myTop10Addresses,
    [myTop10Addresses],
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
    return [...myNotTop10Accounts, ...gnosisAccounts, ...watchAccounts];
  }, [myNotTop10Accounts, gnosisAccounts, watchAccounts]);

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
    matteredAccountCount: filterMyAccounts(sortedList).length,
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
    apisAccountsBalance.getBalanceByAddress(targetAccount.address)
      ?.evmBalance ??
    targetAccount.evmBalance ??
    0;

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
    !asyncResult.value?.borned
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
    accountToShowReceiveTip:
      accountToShowReceiveTip &&
      isAccountToShowReceiveTip(accountToShowReceiveTip)
        ? accountToShowReceiveTip
        : null,
  };
}
