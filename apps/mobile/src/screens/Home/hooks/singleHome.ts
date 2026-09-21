import type { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { RootNames } from '@/constant/layout';
import type { Account } from '@/core/startupServices/preference';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import { useAlias2 } from '@/hooks/alias';
import { resetNavigationOnTopOfHome } from '@/hooks/navigation';
import {
  useAddressBalance,
  useIsLoadingBalance,
} from '@/hooks/useCurrentBalance';
import type { makeDefaultSelectData } from '@/hooks/useCurve';
import { useAddressCurveSelectData, useIsLoadingCurve } from '@/hooks/useCurve';
import { addressCurve24hStore } from '@/store/curve24h';
import {
  balance24hStore,
  useAddress24hChangeFlowState,
} from '@/store/balance24h';
import { buildPortfolioAddressChange } from '@/store/homePortfolio/consistency';
import { navigateDeprecated } from '@/utils/navigation';
import { ellipsisAddress } from '@/utils/address';
import {
  beginFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

type SingleHomeState = {
  currentAccount: Account | null;
  selectedChain: ChainListItem | null;
  foldChart: boolean;
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
        foldChart: prev.foldChart,
        selectedChain: prev.selectedChain,
      };
    }

    return nextState;
  });
}
export const apisSingleHome = {
  navigateToSingleHome: (
    account: Account,
    options?: { replace?: boolean; activationCycleId?: number },
  ) => {
    const cycleId =
      options?.activationCycleId ||
      beginFeatureActivation(
        'single-address',
        'single_address_navigation_requested',
      );
    presetSingHomeAccount(account);
    markFeatureActivation('single-address', 'state-prepared', {
      cycleId,
      reason: 'single_home_account_preset',
    });
    const { replace } = options || {};
    markFeatureActivation('single-address', 'navigation-dispatched', {
      cycleId,
      reason: replace
        ? 'replace_after_state_preset'
        : 'navigate_after_state_preset',
    });
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
};

export function useSingleHomeAccount() {
  return {
    currentAccount: useActivityStore(
      singleHomeState,
      state => state.currentAccount,
      Object.is,
      { storeLabel: 'single-home-state' },
    ),
  };
}

export function useSingleHomeAccountAlias() {
  const { address, brandName } = useActivityStore(
    singleHomeState,
    useShallow(s => ({
      address: s.currentAccount?.address,
      brandName: s.currentAccount?.brandName,
    })),
    Object.is,
    { storeLabel: 'single-home-state' },
  );
  const { adderssAlias, isDefaultAlias } = useAlias2(address || '', {
    autoFetch: true,
  });

  const aliasExist = useMemo(() => {
    return !!address && !!adderssAlias && !isDefaultAlias;
  }, [address, adderssAlias, isDefaultAlias]);

  const nameText = useMemo(
    () => adderssAlias || ellipsisAddress(address || ''),
    [adderssAlias, address],
  );

  return { aliasExist, address, nameText, brandName, isDefaultAlias };
}

export function useSingleHomeAddress() {
  const { currentAddress, lcAddress } = useActivityStore(
    singleHomeState,
    useShallow(s => ({
      currentAddress: s.currentAccount?.address,
      lcAddress: s.currentAccount?.address.toLowerCase() || '',
    })),
    Object.is,
    { storeLabel: 'single-home-state' },
  );

  return { currentAddress, lcAddress };
}

export function useSingleHomeChain() {
  return {
    selectedChain: useActivityStore(
      singleHomeState,
      state => state.selectedChain?.chain,
      Object.is,
      { storeLabel: 'single-home-state' },
    ),
  };
}

export function useHomeFoldChart() {
  return {
    isFoldChart: useActivityStore(
      singleHomeState,
      state => state.foldChart,
      Object.is,
      { storeLabel: 'single-home-state' },
    ),
  };
}

export function useSingleHomeHasNoData() {
  const { lcAddress } = useSingleHomeAddress();
  const curveList =
    useActivityStore(
      addressCurve24hStore.useStore,
      state => state.valueMap[lcAddress],
      Object.is,
      { storeLabel: 'single-home-curve' },
    ) || [];
  const { isLoadingCurve } = useIsLoadingCurve(lcAddress);
  const hasNoData = !curveList.length && !isLoadingCurve;

  return { hasNoData };
}

export function useSingleHomeSelectData() {
  const { lcAddress } = useSingleHomeAddress();
  const { evmBalance, balance } = useAddressBalance(lcAddress);
  const balance24h = useActivityStore(
    balance24hStore.useStore,
    state => state.valueMap[lcAddress],
    Object.is,
    { storeLabel: 'single-home-24h-balance' },
  );
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

    const change = buildPortfolioAddressChange({
      currentEvmBalance: evmBalance,
      previousEvmBalance: balance24h.total_usd_value,
    });

    if (!change) {
      return selectData;
    }

    return {
      ...selectData,
      rawChange: change.rawChange,
      change: '',
      changePercent: change.changePercent,
      isLoss: change.isLoss,
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
