import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { RootNames } from '@/constant/layout';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useAlias2 } from '@/hooks/alias';
import { navigateDeprecated } from '@/utils/navigation';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

type SingleHomeState = {
  currentAccount?: Account;
  selectedChain: ChainListItem | null;
  foldChart: boolean;
  reachTop: boolean;
};
export const singleHomeState = zCreate<SingleHomeState>(() => ({
  currentAccount: undefined,
  selectedChain: null,
  foldChart: false,
  reachTop: false,
}));

function presetSingHomeAccount(account: Account) {
  singleHomeState.setState({
    currentAccount: account,
    selectedChain: null,
    foldChart: false,
    reachTop: false,
  });
}
export const apisSingleHome = {
  navigateToSingleHome: (account: Account) => {
    presetSingHomeAccount(account);
    requestAnimationFrame(() => {
      navigateDeprecated(RootNames.SingleAddressStack, {
        screen: RootNames.SingleAddressHome,
        params: {
          account: account,
        },
      });
    });
  },
  getCurrentAddress: () => {
    return singleHomeState.getState().currentAccount?.address;
  },
  setSelectChainItem: (chain: ChainListItem | null) => {
    singleHomeState.setState({
      selectedChain: chain,
    });
  },
  getSelectedChainItem: () => {
    return singleHomeState.getState().selectedChain || undefined;
  },
  setFoldChart(valOrFunc: UpdaterOrPartials<boolean>) {
    singleHomeState.setState(prev => {
      const { newVal, changed } = resolveValFromUpdater(
        prev.foldChart,
        valOrFunc,
        {
          strict: true,
        },
      );
      if (!changed) return prev;
      return { ...prev, foldChart: newVal };
    });
  },
  setReachTop(valOrFunc: UpdaterOrPartials<boolean>) {
    singleHomeState.setState(prev => {
      const { newVal, changed } = resolveValFromUpdater(
        prev.reachTop,
        valOrFunc,
        {
          strict: true,
        },
      );
      if (!changed) return prev;
      return { ...prev, reachTop: newVal };
    });
  },
};

export function useSingleHomeAccount() {
  return {
    currentAccount: singleHomeState(s => s.currentAccount),
  };
}

export function useSingleHomeAccountAlias() {
  const { address, brandName } = singleHomeState(
    useShallow(s => ({
      address: s.currentAccount?.address,
      brandName: s.currentAccount?.brandName,
    })),
  );
  const { adderssAlias } = useAlias2(address || '', { autoFetch: true });

  const name = useMemo(
    () => adderssAlias || brandName,
    [adderssAlias, brandName],
  );

  return { address, name, brandName };
}

export function useSingleHomeAddress() {
  const currentAddress = singleHomeState(s => s.currentAccount?.address);

  return { currentAddress };
}

export function useSingleHomeChain() {
  return {
    selectedChain: singleHomeState(s => s.selectedChain?.chain),
  };
}

export function useHomeFoldChart() {
  return {
    isFoldChart: singleHomeState(s => s.foldChart),
  };
}

export function useHomeReachTop() {
  return {
    reachTop: singleHomeState(s => s.reachTop),
  };
}
