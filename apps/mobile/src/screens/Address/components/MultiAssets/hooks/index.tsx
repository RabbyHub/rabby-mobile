import {
  filterDirectlySignableAccounts,
  filterOutTop10Accounts,
  isDirectlySignableAccount,
  isHardwareAccount,
} from '@/core/apis/account';
import { openapi } from '@/core/request';
import {
  KeyringAccountWithAlias,
  storeApiAccounts,
  useAccounts,
  useMyAccounts,
} from '@/hooks/account';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { apisAccountsBalance } from '@/hooks/useAccountsBalance';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';

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
  const { top10Accounts, top10Addresses, notTop10Accounts, top10Records } =
    useCreationWithShallowCompare(() => {
      const {
        top10Accounts,
        top10Addresses,
        top10Records,
        restAccounts: notTop10Accounts,
      } = filterOutTop10Accounts(sortedList, { gatherSameAddress: false });

      return {
        top10Accounts,
        top10Addresses,
        top10Records,
        notTop10Accounts,
      };
    }, [sortedList]);

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

  const notMatterAccounts = useCreationWithShallowCompare(() => {
    return [...notTop10Accounts, ...gnosisAccounts, ...watchAccounts];
  }, [notTop10Accounts, gnosisAccounts, watchAccounts]);

  return {
    top10Accounts,
    top10Addresses,
    top10Records,
    notMatterAccounts,
    gnosisAccounts,
    watchAccounts,
    notTop10Accounts,
    list: sortedList,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
    rawAllAccounts: accounts,
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

  let borned = false;
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
  const { accounts } = useMyAccounts({ disableAutoFetch: true });
  const asyncResult = useAsync(
    () =>
      getShowReceiveAddressTip({ caredAccount, isForSingle: !!caredAccount }),
    [caredAccount, accounts],
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

  return {
    targetAccount,
    accountToShowReceiveTip:
      accountToShowReceiveTip &&
      isAccountToShowReceiveTip(accountToShowReceiveTip)
        ? accountToShowReceiveTip
        : null,
  };
}
