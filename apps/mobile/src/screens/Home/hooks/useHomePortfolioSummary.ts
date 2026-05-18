import { zCreate } from '@/core/utils/reexports';
import { filterMyAccounts } from '@/core/apis/account';
import accountStore from '@/store/account';
import addressBalanceStore, { balanceAccountsStore } from '@/store/balance';
import {
  balance24hStore,
  computeCombined24hBalanceData,
  type Combined24hBalanceData,
  scene24hBalanceStore,
} from '@/store/balance24h';
import { makeDefaultSelectData } from '@/store/curveShared';
import { sceneCurve24hStore } from '@/store/curve24h';
import { useShallow } from 'zustand/react/shallow';

type HomeChangeData = Pick<
  Combined24hBalanceData,
  'rawChange' | 'changePercent' | 'isLoss'
>;

type HomePortfolioState = {
  displayAddresses: string[];
  hasResolvedSelection: boolean;
  hasFetchedAccounts: boolean;
  isFetchingAccounts: boolean;
  matteredAccountLength: number;
  isPendingMatteredAccountLength: boolean;
  isPendingDisplayAddresses: boolean;
  totalBalance: number;
  changeData: HomeChangeData;
  curveList: ReturnType<typeof makeDefaultSelectData>['list'];
  showBalanceLoadingWithoutLocal: boolean;
  showChangeLoadingWithoutLocal: boolean;
  isChangeAnyLoading: boolean;
  isCurveAnyAddrLoading: boolean;
  isBalanceFetchingRemote: boolean;
  is24hChangeFetchingRemote: boolean;
  isCurveFetchingRemote: boolean;
  isAnyRemoteRefreshing: boolean;
};

function pickHomeChangeData(data: Combined24hBalanceData): HomeChangeData {
  return {
    rawChange: data.rawChange,
    changePercent: data.changePercent,
    isLoss: data.isLoss,
  };
}

const EMPTY_HOME_CHANGE_DATA = pickHomeChangeData(
  scene24hBalanceStore.getState().combinedData.Home,
);
const EMPTY_HOME_CURVE_LIST =
  sceneCurve24hStore.getState().combinedData.Home.list;

function areAddressListsEqual(prev: string[], next: string[]) {
  if (prev.length !== next.length) {
    return false;
  }

  return prev.every((address, index) => address === next[index]);
}

function getAddressSetSignature(addresses: string[]) {
  return Array.from(new Set(addresses.map(address => address.toLowerCase())))
    .sort()
    .join('|');
}

function normalizeHomeAddresses(addresses: string[]) {
  const seen = new Set<string>();
  const normalizedAddresses: string[] = [];

  addresses.forEach(address => {
    const lowerAddress = address.toLowerCase();
    if (!lowerAddress || seen.has(lowerAddress)) {
      return;
    }

    seen.add(lowerAddress);
    normalizedAddresses.push(lowerAddress);
  });

  return normalizedAddresses;
}

function areCurveListsEqual(
  prev: HomePortfolioState['curveList'],
  next: HomePortfolioState['curveList'],
) {
  if (prev.length !== next.length) {
    return false;
  }

  return prev.every((item, index) => {
    const nextItem = next[index];

    return (
      !!nextItem &&
      item.timestamp === nextItem.timestamp &&
      item.value === nextItem.value &&
      item.rawChange === nextItem.rawChange &&
      item.changePercent === nextItem.changePercent &&
      item.isLoss === nextItem.isLoss
    );
  });
}

function buildInitialState(): HomePortfolioState {
  return {
    displayAddresses: [],
    hasResolvedSelection: false,
    hasFetchedAccounts: false,
    isFetchingAccounts: false,
    matteredAccountLength: 0,
    isPendingMatteredAccountLength: true,
    isPendingDisplayAddresses: true,
    totalBalance: 0,
    changeData: EMPTY_HOME_CHANGE_DATA,
    curveList: EMPTY_HOME_CURVE_LIST,
    showBalanceLoadingWithoutLocal: true,
    showChangeLoadingWithoutLocal: false,
    isChangeAnyLoading: false,
    isCurveAnyAddrLoading: false,
    isBalanceFetchingRemote: false,
    is24hChangeFetchingRemote: false,
    isCurveFetchingRemote: false,
    isAnyRemoteRefreshing: false,
  };
}

function isSameState(prev: HomePortfolioState, next: HomePortfolioState) {
  return (
    areAddressListsEqual(prev.displayAddresses, next.displayAddresses) &&
    prev.hasResolvedSelection === next.hasResolvedSelection &&
    prev.hasFetchedAccounts === next.hasFetchedAccounts &&
    prev.isFetchingAccounts === next.isFetchingAccounts &&
    prev.matteredAccountLength === next.matteredAccountLength &&
    prev.isPendingMatteredAccountLength ===
      next.isPendingMatteredAccountLength &&
    prev.isPendingDisplayAddresses === next.isPendingDisplayAddresses &&
    prev.totalBalance === next.totalBalance &&
    prev.changeData.rawChange === next.changeData.rawChange &&
    prev.changeData.changePercent === next.changeData.changePercent &&
    prev.changeData.isLoss === next.changeData.isLoss &&
    areCurveListsEqual(prev.curveList, next.curveList) &&
    prev.showBalanceLoadingWithoutLocal ===
      next.showBalanceLoadingWithoutLocal &&
    prev.showChangeLoadingWithoutLocal === next.showChangeLoadingWithoutLocal &&
    prev.isChangeAnyLoading === next.isChangeAnyLoading &&
    prev.isCurveAnyAddrLoading === next.isCurveAnyAddrLoading &&
    prev.isBalanceFetchingRemote === next.isBalanceFetchingRemote &&
    prev.is24hChangeFetchingRemote === next.is24hChangeFetchingRemote &&
    prev.isCurveFetchingRemote === next.isCurveFetchingRemote &&
    prev.isAnyRemoteRefreshing === next.isAnyRemoteRefreshing
  );
}

function buildHomePortfolioState(): HomePortfolioState {
  const balanceState = balanceAccountsStore.getState();
  const accountState = accountStore.getState();
  const displayAddresses = normalizeHomeAddresses(
    balanceState.selectedAddresses,
  );
  const scene24hState = scene24hBalanceStore.getState();
  const sceneCurveState = sceneCurve24hStore.getState();
  const currentBalanceMap = addressBalanceStore.getAddressValueMap();
  const balance24hMap = balance24hStore.getAddress24hBalanceMap();
  const displayAddressSignature = getAddressSetSignature(displayAddresses);
  const canUseFetchedAccountLength =
    !balanceState.hasResolvedMatteredAccountLength &&
    accountState.hasFetchedAccounts;
  const matteredAccountLength = canUseFetchedAccountLength
    ? filterMyAccounts(accountState.accounts).length
    : balanceState.matteredAccountLength;
  const isCurveSceneMatched =
    getAddressSetSignature(sceneCurveState.addresses.Home) ===
    displayAddressSignature;

  const isPendingDisplayAddresses =
    !balanceState.hasResolvedSelection &&
    displayAddresses.length === 0 &&
    (!accountState.hasFetchedAccounts || accountState.isFetchingAccounts);
  const showBalanceLoadingWithoutLocal =
    isPendingDisplayAddresses ||
    (displayAddresses.length > 0 && !balanceState.hasAnyBalanceValue);
  const currentBalanceFlow =
    addressBalanceStore.getAddressesFlowState(displayAddresses);
  const missingChangeInputAddresses = displayAddresses.filter(address => {
    return !currentBalanceMap[address] || !balance24hMap[address];
  });
  const scene24hAddrLoading = displayAddresses.some(address => {
    return !!scene24hState.sceneAddrLoading[`Home-${address}`];
  });
  const direct24hAddrLoading = displayAddresses.some(address => {
    const flow = balance24hStore.getAddress24hBalanceFlowState(address);

    return flow.isLoading;
  });
  const isChangeAnyLoading =
    scene24hState.sceneLoading.Home ||
    scene24hState.sceneComputing.Home ||
    scene24hAddrLoading ||
    direct24hAddrLoading ||
    currentBalanceFlow.isAnyLoading;
  const hasAllChangeInputs =
    displayAddresses.length > 0 && missingChangeInputAddresses.length === 0;
  const changeData = displayAddresses.length
    ? pickHomeChangeData(
        computeCombined24hBalanceData({
          addresses: displayAddresses,
          multi24hBalance: balance24hMap,
          balanceMap: currentBalanceMap,
          totalEvmBalance: 0,
          totalBalance: 0,
        }),
      )
    : EMPTY_HOME_CHANGE_DATA;
  const curveList =
    isCurveSceneMatched && sceneCurveState.addresses.Home.length
      ? sceneCurveState.combinedData.Home.list
      : EMPTY_HOME_CURVE_LIST;
  const showChangeLoadingWithoutLocal =
    !showBalanceLoadingWithoutLocal &&
    !changeData.changePercent &&
    (!hasAllChangeInputs || isChangeAnyLoading) &&
    displayAddresses.length > 0;
  const isBalanceFetchingRemote = balanceState.isAnyBalanceFetchingRemote;
  const is24hChangeFetchingRemote =
    scene24hState.sceneLoading.Home ||
    scene24hAddrLoading ||
    direct24hAddrLoading;
  const isCurveFetchingRemote = sceneCurveState.sceneLoading.Home;
  const isCurveAnyAddrLoading =
    !isCurveSceneMatched ||
    sceneCurveState.sceneLoading.Home ||
    sceneCurveState.sceneComputing.Home;

  return {
    displayAddresses,
    hasResolvedSelection: balanceState.hasResolvedSelection,
    hasFetchedAccounts: accountState.hasFetchedAccounts,
    isFetchingAccounts: accountState.isFetchingAccounts,
    matteredAccountLength,
    isPendingMatteredAccountLength:
      !balanceState.hasResolvedMatteredAccountLength &&
      !canUseFetchedAccountLength,
    isPendingDisplayAddresses,
    totalBalance: balanceState.totalBalance,
    changeData,
    curveList,
    showBalanceLoadingWithoutLocal,
    showChangeLoadingWithoutLocal,
    isChangeAnyLoading,
    isCurveAnyAddrLoading,
    isBalanceFetchingRemote,
    is24hChangeFetchingRemote,
    isCurveFetchingRemote,
    isAnyRemoteRefreshing:
      isBalanceFetchingRemote ||
      is24hChangeFetchingRemote ||
      isCurveFetchingRemote,
  };
}

const homePortfolioStore = zCreate<HomePortfolioState>(() =>
  buildInitialState(),
);

let hasStartedHomePortfolioLifecycle = false;

function syncHomePortfolioState() {
  const nextState = buildHomePortfolioState();

  homePortfolioStore.setState(prev => {
    if (isSameState(prev, nextState)) {
      return prev;
    }

    return nextState;
  });
}

function ensureHomePortfolioLifecycle() {
  if (hasStartedHomePortfolioLifecycle) {
    return;
  }

  hasStartedHomePortfolioLifecycle = true;

  balanceAccountsStore.subscribe(syncHomePortfolioState);
  accountStore.subscribe(syncHomePortfolioState);
  addressBalanceStore.subscribe(syncHomePortfolioState);
  balance24hStore.subscribe(syncHomePortfolioState);
  scene24hBalanceStore.subscribe(syncHomePortfolioState);
  sceneCurve24hStore.subscribe(syncHomePortfolioState);

  syncHomePortfolioState();
}

export function useHomePortfolioStore<T>(
  selector: (state: HomePortfolioState) => T,
) {
  ensureHomePortfolioLifecycle();

  return homePortfolioStore(selector);
}

export function useHomePortfolioSummary() {
  return useHomePortfolioStore(state => state);
}

export function useHomePortfolioRefreshState() {
  return useHomePortfolioStore(
    useShallow(state => ({
      displayAddresses: state.displayAddresses,
      isBalanceFetchingRemote: state.isBalanceFetchingRemote,
      is24hChangeFetchingRemote: state.is24hChangeFetchingRemote,
      isCurveFetchingRemote: state.isCurveFetchingRemote,
      isAnyRemoteRefreshing: state.isAnyRemoteRefreshing,
    })),
  );
}
