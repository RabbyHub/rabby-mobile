import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { sortAccountList } from '@/utils/sortAccountList';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { preferenceService } from '@/core/services';

export const useSortAddressList = (accounts: KeyringAccountWithAlias[]) => {
  const { pinAddresses: highlightedAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const list = useCreationWithShallowCompare(() => {
    return sortAccountList(accounts, {
      highlightedAddresses,
    });
  }, [accounts, highlightedAddresses]);

  return list;
};

export function getSortedAddressList(accounts: KeyringAccountWithAlias[]) {
  const highlightedAddresses = preferenceService.getPinAddresses();

  return sortAccountList(accounts, {
    highlightedAddresses,
  });
}
