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
  makeDefaultSelectData,
  useAddressCurveSelectData,
  useIsLoadingCurve,
} from '@/hooks/useCurve';
import { addressCurve24hStore } from '@/store/curve24h';
import {
  balance24hStore,
  useAddress24hChangeFlowState,
} from '@/store/balance24h';
import { computeCurveBalanceChange } from '@/store/curveShared';
import { navigateDeprecated } from '@/utils/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

type SingleHomeState = {
  currentAccount: Account | null;
  selectedChain: ChainListItem | null;
  foldChart: boolean;
  reachTop: boolean;
};

function isSameSingleHomeAccount(prev: Account | null, next: Account) {
  return (
    !!prev &&
    prev.address.toLowerCase() === next.address.toLowerCase() &&
    prev.type === next.type &&
    prev.brandName === next.brandName
  );
}

function shouldKeepPreviousSelectData(
  prev: ReturnType<typeof makeDefaultSelectData> | null,
  next: ReturnType<typeof makeDefaultSelectData>,
  isLoadingCurve: boolean,
) {
  if (!prev || !isLoadingCurve) {
    return false;
  }

  if (!next.list.length && prev.list.length) {
    return true;
  }

  if (!next.changePercent && !!prev.changePercent) {
    return true;
  }

  if (next.changePercent === '0%' && prev.changePercent !== '0%') {
    return true;
  }

  return false;
}

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
  singleHomeState.setState(prev => {
    const nextState = {
      ...getDefault(),
      currentAccount: account,
    };

    if (isSameSingleHomeAccount(prev.currentAccount, account)) {
      return {
        ...nextState,
        reachTop: prev.reachTop,
        foldChart: prev.foldChart,
        selectedChain: prev.selectedChain,
      };
    }

    return nextState;
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
  getFoldChart: () => {
    return singleHomeState.getState().foldChart;
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
      if (!changed) {
        return prev;
      }
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
      if (!changed) {
        return prev;
      }
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
  const curveList = addressCurve24hStore.useAddressCurve(lcAddress) || [];
  const { isLoadingCurve } = useIsLoadingCurve(lcAddress);
  const hasNoData = !curveList.length && !isLoadingCurve;

  return { hasNoData };
}

export function useSingleHomeSelectData() {
  const { lcAddress } = useSingleHomeAddress();
  const { evmBalance, balance } = useAddressBalance(lcAddress);
  const { balance24h } = balance24hStore.useAddress24hBalance(lcAddress);
  const { isLoadingCurve } = useIsLoadingCurve(lcAddress);
  const selectData = useAddressCurveSelectData(lcAddress, {
    realtimeNetWorth: evmBalance,
    staticBalance: balance,
    baseUsdValue: balance24h?.total_usd_value,
  });
  const selectDataWithFallback = useMemo(() => {
    if (selectData.changePercent) {
      return selectData;
    }

    if (
      typeof evmBalance !== 'number' ||
      typeof balance24h?.total_usd_value !== 'number'
    ) {
      return selectData;
    }

    const { assetsChange, changePercent } = computeCurveBalanceChange(
      evmBalance,
      balance24h.total_usd_value,
    );

    return {
      ...selectData,
      rawChange: assetsChange,
      change: '',
      changePercent,
      isLoss: assetsChange < 0,
    };
  }, [balance24h?.total_usd_value, evmBalance, selectData]);
  const lastStableSelectDataRef = useRef(selectDataWithFallback);
  const displaySelectData = useMemo(() => {
    return shouldKeepPreviousSelectData(
      lastStableSelectDataRef.current,
      selectDataWithFallback,
      isLoadingCurve,
    )
      ? lastStableSelectDataRef.current
      : selectDataWithFallback;
  }, [isLoadingCurve, selectDataWithFallback]);

  useEffect(() => {
    if (displaySelectData !== lastStableSelectDataRef.current) {
      lastStableSelectDataRef.current = displaySelectData;
    }
  }, [displaySelectData]);

  return { selectData: displaySelectData };
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
  const { evmBalance } = useAddressBalance(lcAddress);

  return {
    noAssetsValue: !balanceLoading && evmBalance === 0,
  };
}

export function useSingleHomeHomeTopChart() {
  const { lcAddress } = useSingleHomeAddress();
  const { selectData } = useSingleHomeSelectData();
  const { balanceLoading, isLoadingCurve } = useSingleHomeLoading();
  const { evmBalance, balance } = useAddressBalance(lcAddress);
  const changeFlow = useAddress24hChangeFlowState(lcAddress, {
    isComputing: isLoadingCurve,
  });

  const balanceLoadingWithoutLocal = balanceLoading && !balance;
  const isLoadingChartData = isLoadingCurve || balanceLoadingWithoutLocal;
  const changeLoading =
    !balanceLoadingWithoutLocal &&
    !selectData.changePercent &&
    changeFlow.isLoading;

  return {
    balanceLoadingWithoutLocal,
    isLoadingChartData,
    changeLoading,
    selectData,
    balance,
    evmBalance,
  };
}

export function useSingleHomeIsDecrease() {
  const { selectData } = useSingleHomeSelectData();
  const isDecrease = selectData.isLoss;
  return { isDecrease };
}

export function useSingleHomeIsLoss() {
  const { selectData } = useSingleHomeSelectData();
  const isLoss = !!selectData.isLoss;
  return { isLoss };
}
