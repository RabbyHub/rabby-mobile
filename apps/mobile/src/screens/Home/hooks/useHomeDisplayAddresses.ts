import { useShallow } from 'zustand/react/shallow';
import { useHomePortfolioStore } from './useHomePortfolioSummary';

export function useHomeDisplayAddresses() {
  return useHomePortfolioStore(
    useShallow(state => ({
      selectedAddresses: state.displayAddresses,
      displayAddresses: state.displayAddresses,
      myTop10Addresses: state.displayAddresses,
      hasResolvedSelection: state.hasResolvedSelection,
      hasFetchedAccounts: state.hasFetchedAccounts,
      isFetchingAccounts: state.isFetchingAccounts,
      isPendingDisplayAddresses: state.isPendingDisplayAddresses,
    })),
  );
}
