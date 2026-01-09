import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { RootNames } from '@/constant/layout';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useAlias2 } from '@/hooks/alias';
import { resetNavigationOnTopOfHome } from '@/hooks/navigation';
import {
  useAddressBalance,
  useIsLoadingBalance,
} from '@/hooks/useCurrentBalance';
import {
  loadingCurveState,
  makeDefaultSelectData,
  useIsLoadingCurve,
} from '@/hooks/useCurve';
import { navigateDeprecated } from '@/utils/navigation';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

type SingleHomeState = {
  currentAccount: Account | null;
  selectedChain: ChainListItem | null;
  foldChart: boolean;
  reachTop: boolean;
};
function getDefault(): SingleHomeState {
  return {
    currentAccount: null,
    selectedChain: null,
    foldChart: true,
    reachTop: false,
  };
}
const singleHomeState = zCreate<SingleHomeState>(() => getDefault());

function presetSingHomeAccount(account: Account) {
  singleHomeState.setState({
    ...getDefault(),
    currentAccount: account,
  });
}
export const apisSingleHome = {
  navigateToSingleHome: (account: Account, options?: { replace?: boolean }) => {
    presetSingHomeAccount(account);
    requestAnimationFrame(() => {
      const { replace } = options || {};
      if (replace) {
        resetNavigationOnTopOfHome(RootNames.SingleAddressStack, {
          screen: RootNames.SingleAddressHome,
          params: {
            account: account,
          },
        });
      } else {
        navigateDeprecated(RootNames.SingleAddressStack, {
          screen: RootNames.SingleAddressHome,
          params: {
            account: account,
          },
        });
      }
    });
  },
  clearCurrentAccount: () => {
    singleHomeState.setState(prev => ({
      ...prev,
      currentAccount: null,
    }));
  },
  getCurrentAddress: () => {
    return singleHomeState.getState().currentAccount?.address;
  },
  getCurrentAccount: () => {
    return singleHomeState.getState().currentAccount;
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
  const { adderssAlias, isDefaultAlias } = useAlias2(address || '', {
    autoFetch: true,
  });

  const aliasExist = useMemo(() => {
    return !!address && !!adderssAlias && !isDefaultAlias;
  }, [address, adderssAlias, isDefaultAlias]);

  const nameText = useMemo(
    () => adderssAlias || brandName,
    [adderssAlias, brandName],
  );

  return { aliasExist, address, nameText, brandName, isDefaultAlias };
}

export function useSingleHomeAddress() {
  const { currentAddress, lcAddress } = singleHomeState(
    useShallow(s => ({
      currentAddress: s.currentAccount?.address,
      lcAddress: s.currentAccount?.address.toLowerCase() || '',
    })),
  );

  return { currentAddress, lcAddress };
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

export function useSingleHomeHasNoData() {
  const { lcAddress } = useSingleHomeAddress();
  const hasNoData = loadingCurveState(s => {
    return !s[lcAddress]?.curveList.length && !s[lcAddress]?.loadingCurve;
  });

  return { hasNoData };
}

export function useSingleHomeSelectData() {
  const { lcAddress } = useSingleHomeAddress();

  const defaultSelectData = useMemo(() => makeDefaultSelectData(), []);
  const selectData = loadingCurveState(
    s => (!lcAddress ? null : s[lcAddress]?.selectData) || defaultSelectData,
  );

  return { selectData };
}

export function useSingleHomeLoading() {
  const { lcAddress } = useSingleHomeAddress();
  const { balanceLoading } = useIsLoadingBalance(lcAddress);
  const { isLoadingCurve } = useIsLoadingCurve(lcAddress);

  return {
    balanceLoading,
    isLoadingCurve,
  };
}

export function useSingleHomeNoAssetsValueOnChain() {
  const { lcAddress } = useSingleHomeAddress();
  const { balanceLoading } = useIsLoadingBalance(lcAddress);
  const { evmBalance, balance } = useAddressBalance(lcAddress);

  return {
    noAssetsValue: !balanceLoading && evmBalance === 0,
  };
}

export function useSingleHomeHomeTopChart() {
  const { lcAddress } = useSingleHomeAddress();
  const { selectData } = useSingleHomeSelectData();
  const { balanceLoading, isLoadingCurve } = useSingleHomeLoading();
  const { evmBalance, balance } = useAddressBalance(lcAddress);

  const balanceLoadingWithoutLocal =
    balanceLoading && (!evmBalance || !selectData.rawNetWorth);
  const isLoadingChartData = isLoadingCurve || balanceLoadingWithoutLocal;

  return {
    balanceLoadingWithoutLocal,
    isLoadingChartData,
    selectData,
  };
}

export function useSingleHomeIsDecrease() {
  const { lcAddress } = useSingleHomeAddress();
  const isDecrease = loadingCurveState(s =>
    !lcAddress ? false : s[lcAddress]?.isDecrease,
  );
  return { isDecrease };
}

export function useSingleHomeIsLoss() {
  const { lcAddress } = useSingleHomeAddress();
  const isLoss = loadingCurveState(s =>
    !lcAddress ? false : !!s[lcAddress]?.selectData?.isLoss,
  );
  return { isLoss };
}
