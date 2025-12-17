import { filterOutTop10Accounts } from '@/core/apis/account';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const isTabsSwiping = {
  value: false,
};

export const useAccountInfo = () => {
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
};
