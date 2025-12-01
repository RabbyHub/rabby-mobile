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

  const filterAccounts = useCreationWithShallowCompare(
    () => filterMyAccounts(accounts),
    [accounts],
  );

  const list = useSortAddressList(filterAccounts);
  const { addresses: top10Addresses, notTop10Addresses } =
    useCreationWithShallowCompare(() => {
      const addresses = [
        ...new Set(list.slice(0, 10).map(i => i.address.toLowerCase())),
      ];
      return {
        addresses,
        notTop10Addresses: list.slice(10),
      };
    }, [list]);

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
    return [...notTop10Addresses, ...gnosisAccounts, ...watchAccounts];
  }, [notTop10Addresses, gnosisAccounts, watchAccounts]);

  return {
    top10Addresses,
    notMatterAccounts,
    gnosisAccounts,
    watchAccounts,
    notTop10Addresses,
    list,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
    rawAllAccounts: accounts,
  };
};
