import {
  APP_RUNTIME_ENV,
  BUILD_GIT_INFO,
  IS_HERMES_ENABLED,
} from '@/constant/env';
import { computeBalanceChange } from '@/core/apis/balance';
import { runDevIIFEFunc } from '@/core/utils/store';
import {
  balanceAccountsStore,
  type AccountsBalanceState,
} from '@/hooks/useAccountsBalance';
import {
  getScene24hBalanceState,
  type Multi24hBalanceState,
} from '@/hooks/useScene24hBalance';
import {
  getMultiCurveCombinedData,
  getMultiCurveState,
} from '@/hooks/useMultiCurve';
import { loadingCurveState, makeDefaultSelectData } from '@/hooks/useCurve';
import { getIsFoldMultiChart } from '@/screens/Address/components/MultiAssets/RenderRow/CurveChart';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import accountStore from '@/store/account';
import balanceStore from '@/store/balance';
import { getLatestNavigationName } from '@/utils/navigation';

type DevtoolsMethod = (...args: unknown[]) => unknown;

function normalizeAddresses(addresses?: string[]) {
  return Array.from(
    new Set(
      (addresses || []).filter(Boolean).map(address => address.toLowerCase()),
    ),
  );
}

function getBalanceFlowState(address: string) {
  const lowerAddress = address.toLowerCase();
  const state = balanceStore.getState();
  const hasValue = !!state.balanceMap[lowerAddress];
  const isLoading = !!state.isLoadingByAddress[lowerAddress];

  return {
    hasValue,
    isLoading,
    isLoadingWithoutValue: isLoading && !hasValue,
  };
}

function buildHomeDisplayAddressesState() {
  const balanceState = balanceAccountsStore.getState();
  const accountState = accountStore.getState();
  const scene24hState = getScene24hBalanceState();
  const selectedAddresses = normalizeAddresses(balanceState.selectedAddresses);
  const sceneAddresses = normalizeAddresses(scene24hState.addresses.Home);
  const displayAddresses = selectedAddresses.length
    ? selectedAddresses
    : sceneAddresses;

  return {
    selectedAddresses,
    sceneAddresses,
    displayAddresses,
    displaySource: selectedAddresses.length
      ? 'selected'
      : sceneAddresses.length
      ? 'scene24h'
      : 'empty',
    hasResolvedSelection:
      selectedAddresses.length > 0 || accountState.accounts.length > 0,
    matteredAccountLength: balanceState.matteredAccountLength,
    hasFetchedAccounts: accountState.accounts.length > 0,
    isFetchingAccounts: false,
    isPendingDisplayAddresses:
      displayAddresses.length === 0 && accountState.accounts.length > 0,
  };
}

function buildBalanceSummary(addresses: string[]) {
  const normalizedAddresses = normalizeAddresses(addresses);
  const state = balanceStore.getState();
  const snapshots = normalizedAddresses.map(address => {
    const lowerAddress = address.toLowerCase();
    const value = state.balanceMap[lowerAddress];
    const flow = getBalanceFlowState(lowerAddress);

    return {
      address: lowerAddress,
      value: value
        ? {
            totalBalance: value.totalBalance,
            evmBalance: value.evmBalance,
            chainListLength: state.chainUSDMap[lowerAddress]?.length || 0,
          }
        : null,
      flow,
    };
  });

  const loadingAddresses = snapshots
    .filter(item => item.flow.isLoading)
    .map(item => item.address);
  const missingAddresses = snapshots
    .filter(item => !item.flow.hasValue)
    .map(item => item.address);

  return {
    snapshots,
    flow: {
      addresses: normalizedAddresses,
      loadingAddresses,
      missingAddresses,
      hasAnyValue: snapshots.some(item => item.flow.hasValue),
      isAnyLoading: loadingAddresses.length > 0,
      isAnyLoadingWithoutValue: snapshots.some(
        item => item.flow.isLoadingWithoutValue,
      ),
      hasAllValues:
        normalizedAddresses.length > 0 && missingAddresses.length === 0,
    },
    totalBalance: snapshots.reduce((acc, item) => {
      return acc + (item.value?.totalBalance || 0);
    }, 0),
  };
}

function getScene24hFlowState(
  scene24hState: Multi24hBalanceState,
  address: string,
) {
  const lowerAddress = address.toLowerCase();
  const hasValue = !!scene24hState.multi24hBalance[lowerAddress];
  const isLoading =
    !!scene24hState.sceneAddrLoading[`Home-${lowerAddress}`] ||
    !!scene24hState.sceneLoading.Home;

  return {
    hasValue,
    isHydrating: false,
    isFetchingRemote: isLoading,
    isResourceLoading: isLoading,
    isComputing: false,
    isLoading,
    isLoadingWithoutValue: isLoading && !hasValue,
    persistStatus: hasValue ? 'hydrated' : 'idle',
    lastError: null,
  };
}

function build24hFlowSummary(addresses: string[]) {
  const normalizedAddresses = normalizeAddresses(addresses);
  const scene24hState = getScene24hBalanceState();
  const states = normalizedAddresses.map(address => {
    const flow = getScene24hFlowState(scene24hState, address);

    return {
      address,
      ...flow,
    };
  });

  const loadingAddresses = states
    .filter(item => item.isLoading)
    .map(item => item.address);
  const missingAddresses = states
    .filter(item => !item.hasValue)
    .map(item => item.address);

  return {
    addresses: normalizedAddresses,
    states,
    flow: {
      addresses: normalizedAddresses,
      loadingAddresses,
      missingAddresses,
      computingAddresses: [] as string[],
      hasAnyValue: states.some(item => item.hasValue),
      isAnyLoading: loadingAddresses.length > 0,
      isAnyLoadingWithoutValue: states.some(item => item.isLoadingWithoutValue),
      hasAllValues:
        normalizedAddresses.length > 0 && missingAddresses.length === 0,
    },
  };
}

function build24hCombinedData(
  scene24hState: Multi24hBalanceState,
  addresses: string[],
) {
  const normalizedAddresses = normalizeAddresses(addresses);
  const balanceState = balanceStore.getState();
  const comparableAddresses = normalizedAddresses.filter(address => {
    return (
      !!scene24hState.multi24hBalance[address] &&
      !!balanceState.balanceMap[address]
    );
  });
  const availableCurrentAddresses = normalizedAddresses.filter(address => {
    return !!balanceState.balanceMap[address];
  });
  const totalCurrentBalance = availableCurrentAddresses.reduce(
    (result, address) => {
      return result + (balanceState.balanceMap[address]?.totalBalance || 0);
    },
    0,
  );
  const totalComparableEvmBalance = comparableAddresses.reduce(
    (result, address) => {
      return result + (balanceState.balanceMap[address]?.evmBalance || 0);
    },
    0,
  );
  const total24hBalance = comparableAddresses.reduce((result, address) => {
    return (
      result + (scene24hState.multi24hBalance[address]?.total_usd_value || 0)
    );
  }, 0);
  const canShowCurrentBalance = availableCurrentAddresses.length > 0;
  const canShowChange = comparableAddresses.length > 0;
  const { assetsChange, changePercent } = computeBalanceChange(
    totalComparableEvmBalance,
    total24hBalance,
  );

  return {
    comparableAddresses,
    rawNetWorth: canShowCurrentBalance ? totalCurrentBalance : 0,
    netWorth: scene24hState.combinedData.Home.netWorth,
    rawChange: canShowChange ? assetsChange : 0,
    change: scene24hState.combinedData.Home.change,
    changePercent: canShowChange ? changePercent : '',
    isLoss: canShowChange ? assetsChange < 0 : false,
    isEmptyAssets: scene24hState.combinedData.Home.isEmptyAssets,
    listLength: comparableAddresses.length,
  };
}

function buildHomeCurveUiState(
  addresses: string[],
  scene24hState: Multi24hBalanceState,
) {
  const curveState = getMultiCurveState();
  const combinedCurveData = getMultiCurveCombinedData();
  const normalizedAddresses = normalizeAddresses(addresses);
  const isInitial24hLoading =
    normalizedAddresses.length > 0 &&
    normalizedAddresses.every(
      address => !scene24hState.multi24hBalance[address],
    );
  const isCurveLoading =
    curveState.loading ||
    normalizedAddresses.some(address => curveState.addrLoading[address]);

  return {
    isFolded: getIsFoldMultiChart(),
    hasCurveData: combinedCurveData.list.length > 0,
    curvePointCount: combinedCurveData.list.length,
    isCurveLoading,
    changeLoading: isInitial24hLoading,
    balanceLoadingWithoutLocal: isInitial24hLoading,
  };
}

function buildSingleHomeSnapshot() {
  const currentAddress =
    apisSingleHome.getCurrentAddress()?.toLowerCase() || null;
  const routeName = getLatestNavigationName() || null;

  if (!currentAddress) {
    return {
      routeName,
      currentAddress: null,
      hasCurrentAddress: false,
    };
  }

  const balanceState = balanceStore.getState();
  const balanceValue = balanceState.balanceMap[currentAddress] || null;
  const balanceFlow = getBalanceFlowState(currentAddress);
  const curveState = loadingCurveState.getState()[currentAddress];
  const selectData = curveState?.selectData || makeDefaultSelectData();
  const balanceLoadingWithoutLocal =
    balanceFlow.isLoading && !(balanceValue?.totalBalance || 0);
  const isLoadingChartData =
    !!curveState?.loadingCurve || balanceLoadingWithoutLocal;
  const changeLoading =
    !balanceLoadingWithoutLocal &&
    isLoadingChartData &&
    !selectData.changePercent;
  const curveList = curveState?.curveList || [];

  return {
    routeName,
    currentAddress,
    hasCurrentAddress: true,
    balanceValue: balanceValue
      ? {
          totalBalance: balanceValue.totalBalance,
          evmBalance: balanceValue.evmBalance,
          chainListLength:
            balanceState.chainUSDMap[currentAddress]?.length || 0,
        }
      : null,
    balanceFlow,
    curveFlow: {
      isLoading: !!curveState?.loadingCurve,
      hasValue: curveList.length > 0,
    },
    uiState: {
      balanceLoadingWithoutLocal,
      isLoadingChartData,
      changeLoading,
    },
    curveUiState: {
      isFolded: apisSingleHome.getFoldChart(),
      hasCurveData: curveList.length > 0,
      curvePointCount: curveList.length,
      isCurveLoading: !!curveState?.loadingCurve,
      changeLoading,
      balanceLoadingWithoutLocal,
    },
    selectData: {
      netWorth: selectData.netWorth,
      rawChange: selectData.rawChange,
      changePercent: selectData.changePercent,
      isLoss: selectData.isLoss,
      listLength: selectData.list.length,
    },
  };
}

function buildHomePortfolioSnapshot() {
  const routeName = getLatestNavigationName() || null;
  const displayAddressesState = buildHomeDisplayAddressesState();
  const displayAddresses = displayAddressesState.displayAddresses;
  const balanceSummary = buildBalanceSummary(displayAddresses);
  const changeSummary = build24hFlowSummary(displayAddresses);
  const scene24hState = getScene24hBalanceState();
  const combined24hData = build24hCombinedData(scene24hState, displayAddresses);
  const curveUiState = buildHomeCurveUiState(displayAddresses, scene24hState);

  return {
    routeName,
    displayAddressesState,
    uiState: {
      showBalanceLoadingWithoutLocal: curveUiState.balanceLoadingWithoutLocal,
      showChangeLoadingWithoutLocal: curveUiState.changeLoading,
    },
    curveUiState,
    balanceAccountsState: {
      selectedAddresses: balanceAccountsStore.getState().selectedAddresses,
      hasResolvedSelection: displayAddressesState.hasResolvedSelection,
      matteredAccountLength:
        balanceAccountsStore.getState().matteredAccountLength,
    },
    balanceSummary,
    changeSummary: {
      ...changeSummary,
      combinedData: combined24hData,
      hasAnyComparableValue: combined24hData.comparableAddresses.length > 0,
    },
    scene24hState: {
      addresses: scene24hState.addresses.Home,
      sceneLoading: scene24hState.sceneLoading.Home,
      sceneComputing: false,
      combinedData: {
        rawNetWorth: scene24hState.combinedData.Home.rawNetWorth,
        rawChange: scene24hState.combinedData.Home.rawChange,
        changePercent: scene24hState.combinedData.Home.changePercent,
        isLoss: scene24hState.combinedData.Home.isLoss,
        listLength: scene24hState.combinedData.Home.list.length,
      },
    },
    sceneCurveState: {
      addresses: displayAddresses,
      sceneLoading: curveUiState.isCurveLoading,
      sceneComputing: false,
      combinedData: {
        netWorth: getMultiCurveCombinedData().netWorth,
        rawChange: getMultiCurveCombinedData().rawChange,
        changePercent: getMultiCurveCombinedData().changePercent,
        isLoss: getMultiCurveCombinedData().isLoss,
        listLength: getMultiCurveCombinedData().list.length,
      },
    },
  };
}

const bridgeMethods = {
  ping() {
    return {
      ok: true,
      runtimeEnv: APP_RUNTIME_ENV,
      isHermesEnabled: IS_HERMES_ENABLED,
      buildGitHash: BUILD_GIT_INFO.BUILD_GIT_HASH,
      routeName: getLatestNavigationName() || null,
      timestamp: Date.now(),
    };
  },
  getHomePortfolioSnapshot() {
    return buildHomePortfolioSnapshot();
  },
  getSingleHomeSnapshot() {
    return buildSingleHomeSnapshot();
  },
} satisfies Record<string, DevtoolsMethod>;

runDevIIFEFunc(() => {
  const bridge: RabbyDevToolsBridge = {
    listMethods: () =>
      Object.keys(bridgeMethods).sort() as RabbyDevToolsBridgeMethodName[],
    hasMethod: (name: string) => typeof bridgeMethods[name] === 'function',
    invoke: async (name: string, ...args: unknown[]) => {
      const method = bridgeMethods[name];

      if (!method) {
        throw new Error(`[RabbyDevToolsBridge] Unknown method: ${name}`);
      }

      return await method(...args);
    },
    ping: () => bridgeMethods.ping(),
    getHomePortfolioSnapshot: () => bridgeMethods.getHomePortfolioSnapshot(),
    getSingleHomeSnapshot: () => bridgeMethods.getSingleHomeSnapshot(),
  };

  globalThis.__RABBY_DEVTOOLS_BRIDGE__ = bridge;
});
