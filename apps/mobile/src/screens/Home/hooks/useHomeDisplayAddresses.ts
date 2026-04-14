import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { useAccountStore } from '@/store/account';
import { balanceAccountsStore } from '@/store/balance';

export function useHomeDisplayAddresses() {
  const { selectedAddresses, hasResolvedSelection } = balanceAccountsStore(
    useShallow(s => ({
      selectedAddresses: s.selectedAddresses,
      hasResolvedSelection: s.hasResolvedSelection,
    })),
  );
  const { hasFetchedAccounts, isFetchingAccounts } = useAccountStore(
    useShallow(s => ({
      hasFetchedAccounts: s.hasFetchedAccounts,
      isFetchingAccounts: s.isFetchingAccounts,
    })),
  );
  const { myTop10Addresses } = useAccountInfo();

  const displayAddresses = useMemo(() => {
    return selectedAddresses.length ? selectedAddresses : myTop10Addresses;
  }, [myTop10Addresses, selectedAddresses]);

  const isPendingDisplayAddresses =
    !hasResolvedSelection &&
    displayAddresses.length === 0 &&
    (!hasFetchedAccounts ||
      isFetchingAccounts ||
      myTop10Addresses.length === 0);

  return useMemo(
    () => ({
      selectedAddresses,
      displayAddresses,
      myTop10Addresses,
      hasResolvedSelection,
      hasFetchedAccounts,
      isFetchingAccounts,
      isPendingDisplayAddresses,
    }),
    [
      displayAddresses,
      hasFetchedAccounts,
      hasResolvedSelection,
      isFetchingAccounts,
      isPendingDisplayAddresses,
      myTop10Addresses,
      selectedAddresses,
    ],
  );
}
