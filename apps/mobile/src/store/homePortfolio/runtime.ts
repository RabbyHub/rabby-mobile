import { filterMyAccounts } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import accountStore from '@/store/account';
import addressBalanceStore, { balanceAccountsStore } from '@/store/balance';
import { balance24hStore, scene24hBalanceStore } from '@/store/balance24h';
import { addressCurve24hStore, sceneCurve24hStore } from '@/store/curve24h';
import type { ResourceFlowState } from '@/store/_resourceBase';
import {
  areHomeCurveProjectionsEqual,
  buildHomeCurveProjection,
  type HomeCurveProjection,
} from './curve';
import {
  areHome24hProjectionsEqual,
  areHomeBalanceProjectionsEqual,
  buildHome24hProjection,
  buildHomeBalanceProjection,
  createInitialHomeAccountProjection,
  getHomeSelectionSignature,
  reduceHomeAccountProjection,
  type Home24hProjection,
  type HomeAccountProjection,
  type HomeBalanceProjection,
  type HomeProjectionResourceFlow,
} from './model';
import {
  createInitialHomeContentReadinessProjection,
  reduceHomeContentReadinessProjection,
  type HomeContentReadinessProjection,
} from './readiness';
import {
  areHomeRefreshProjectionsEqual,
  buildHomeRefreshProjection,
  type HomeRefreshProjection,
} from './refresh';

const EMPTY_ACTIVITY = {
  isHydrating: false,
  isFetchingRemote: false,
  isComputing: false,
  isActive: false,
  activeAddresses: [],
};

const EMPTY_BALANCE_PROJECTION: HomeBalanceProjection = {
  availability: 'unresolved',
  selectionSignature: '',
  selectionGeneration: 0,
  sourceAddresses: [],
  missingAddresses: [],
  activity: EMPTY_ACTIVITY,
};

const EMPTY_24H_PROJECTION: Home24hProjection = {
  availability: 'unresolved',
  selectionSignature: '',
  selectionGeneration: 0,
  sourceAddresses: [],
  missingAddresses: [],
  activity: EMPTY_ACTIVITY,
};

const EMPTY_CURVE_PROJECTION: HomeCurveProjection = {
  availability: 'unresolved',
  selectionSignature: '',
  selectionGeneration: 0,
  sourceAddresses: [],
  missingAddresses: [],
  activity: EMPTY_ACTIVITY,
};

const EMPTY_REFRESH_PROJECTION: HomeRefreshProjection = {
  selectionSignature: '',
  selectionGeneration: 0,
  isBalanceFetchingRemote: false,
  is24hChangeFetchingRemote: false,
  isCurveFetchingRemote: false,
  isAnyRemoteRefreshing: false,
};

const homeAccountProjectionStore = zCreate<HomeAccountProjection>(() =>
  createInitialHomeAccountProjection(),
);
const homeBalanceProjectionStore = zCreate<HomeBalanceProjection>(
  () => EMPTY_BALANCE_PROJECTION,
);
const home24hProjectionStore = zCreate<Home24hProjection>(
  () => EMPTY_24H_PROJECTION,
);
const homeCurveProjectionStore = zCreate<HomeCurveProjection>(
  () => EMPTY_CURVE_PROJECTION,
);
const homeRefreshProjectionStore = zCreate<HomeRefreshProjection>(
  () => EMPTY_REFRESH_PROJECTION,
);
const homeContentReadinessProjectionStore =
  zCreate<HomeContentReadinessProjection>(() =>
    createInitialHomeContentReadinessProjection(),
  );

function toProjectionFlow(flow: ResourceFlowState) {
  return {
    isHydrating: flow.isHydrating,
    isFetchingRemote: flow.isFetchingRemote,
  } satisfies HomeProjectionResourceFlow;
}

function buildFlowMap(
  addresses: string[],
  getFlow: (address: string) => ResourceFlowState,
) {
  return addresses.reduce((result, address) => {
    result[address] = toProjectionFlow(getFlow(address));
    return result;
  }, {} as Record<string, HomeProjectionResourceFlow>);
}

function syncHomeAccountProjection() {
  const balanceState = balanceAccountsStore.getState();
  const accountsState = accountStore.getState();
  const canUseFetchedAccountLength =
    !balanceState.hasResolvedMatteredAccountLength &&
    accountsState.hasFetchedAccounts;

  homeAccountProjectionStore.setState(previous =>
    reduceHomeAccountProjection(previous, {
      selectedAddresses: balanceState.selectedAddresses,
      hasResolvedSelection: balanceState.hasResolvedSelection,
      matteredAccountLength: canUseFetchedAccountLength
        ? filterMyAccounts(accountsState.accounts).length
        : balanceState.matteredAccountLength,
      hasResolvedMatteredAccountLength:
        balanceState.hasResolvedMatteredAccountLength ||
        canUseFetchedAccountLength,
      hasFetchedAccounts: accountsState.hasFetchedAccounts,
      isFetchingAccounts: accountsState.isFetchingAccounts,
    }),
  );
}

function syncHomeBalanceProjection() {
  const account = homeAccountProjectionStore.getState();
  const next = buildHomeBalanceProjection({
    account,
    valueMap: addressBalanceStore.getAddressValueMap(),
    flowMap: buildFlowMap(
      account.addresses,
      addressBalanceStore.getAddressFlowState,
    ),
  });

  homeBalanceProjectionStore.setState(previous =>
    areHomeBalanceProjectionsEqual(previous, next) ? previous : next,
  );
}

function syncHome24hProjection() {
  const account = homeAccountProjectionStore.getState();
  const sceneState = scene24hBalanceStore.getState();
  const isCurrentSelectionComputing =
    getHomeSelectionSignature(sceneState.addresses.Home) ===
      account.selectionSignature && sceneState.sceneComputing.Home;
  const currentFlowMap = buildFlowMap(
    account.addresses,
    addressBalanceStore.getAddressFlowState,
  );
  const previousFlowMap = buildFlowMap(
    account.addresses,
    balance24hStore.getAddress24hBalanceFlowState,
  );

  if (
    getHomeSelectionSignature(sceneState.addresses.Home) ===
    account.selectionSignature
  ) {
    account.addresses.forEach(address => {
      if (
        sceneState.sceneLoading.Home ||
        sceneState.sceneAddrLoading[`Home-${address}`]
      ) {
        previousFlowMap[address] = {
          ...previousFlowMap[address],
          isFetchingRemote: true,
        };
      }
    });
  }

  const next = buildHome24hProjection({
    account,
    currentBalanceMap: addressBalanceStore.getAddressValueMap(),
    previousBalanceMap: balance24hStore.getAddress24hBalanceMap(),
    currentFlowMap,
    previousFlowMap,
    isComputing: isCurrentSelectionComputing,
  });

  home24hProjectionStore.setState(previous =>
    areHome24hProjectionsEqual(previous, next) ? previous : next,
  );
}

function syncHomeCurveProjection() {
  const account = homeAccountProjectionStore.getState();
  const sceneState = sceneCurve24hStore.getState();
  const next = buildHomeCurveProjection({
    account,
    sceneAddresses: sceneState.addresses.Home,
    list: sceneState.combinedData.Home.list,
    curveValueMap: addressCurve24hStore.getAddressCurveMap(),
    flowMap: buildFlowMap(
      account.addresses,
      addressCurve24hStore.getAddressCurveFlowState,
    ),
    isSceneLoading: sceneState.sceneLoading.Home,
    isSceneComputing: sceneState.sceneComputing.Home,
  });

  homeCurveProjectionStore.setState(previous =>
    areHomeCurveProjectionsEqual(previous, next) ? previous : next,
  );
}

function syncHomeRefreshProjection() {
  const next = buildHomeRefreshProjection({
    balance: homeBalanceProjectionStore.getState(),
    change24h: home24hProjectionStore.getState(),
    curve: homeCurveProjectionStore.getState(),
  });

  homeRefreshProjectionStore.setState(previous =>
    areHomeRefreshProjectionsEqual(previous, next) ? previous : next,
  );
}

function syncHomeContentReadinessProjection() {
  homeContentReadinessProjectionStore.setState(previous =>
    reduceHomeContentReadinessProjection(previous, {
      account: homeAccountProjectionStore.getState(),
      balance: homeBalanceProjectionStore.getState(),
      change24h: home24hProjectionStore.getState(),
    }),
  );
}

function syncProjectionCoordinators() {
  syncHomeRefreshProjection();
  syncHomeContentReadinessProjection();
}

function syncSelectionDependentProjections() {
  syncHomeAccountProjection();
  syncHomeBalanceProjection();
  syncHome24hProjection();
  syncHomeCurveProjection();
  syncProjectionCoordinators();
}

let hasStartedHomeProjectionLifecycle = false;

export function ensureHomeProjectionLifecycle() {
  if (hasStartedHomeProjectionLifecycle) {
    return;
  }

  hasStartedHomeProjectionLifecycle = true;

  balanceAccountsStore.subscribe(syncSelectionDependentProjections);
  accountStore.subscribe(syncSelectionDependentProjections);
  addressBalanceStore.subscribe(() => {
    syncHomeBalanceProjection();
    syncHome24hProjection();
    syncProjectionCoordinators();
  });
  balance24hStore.subscribe(() => {
    syncHome24hProjection();
    syncProjectionCoordinators();
  });
  scene24hBalanceStore.subscribe(() => {
    syncHome24hProjection();
    syncProjectionCoordinators();
  });
  addressCurve24hStore.subscribe(() => {
    syncHomeCurveProjection();
    syncHomeRefreshProjection();
  });
  sceneCurve24hStore.subscribe(() => {
    syncHomeCurveProjection();
    syncHomeRefreshProjection();
  });

  syncSelectionDependentProjections();
}

export function useHomeAccountProjection<T>(
  selector: (state: HomeAccountProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return homeAccountProjectionStore(selector);
}

export function useHomeBalanceProjection<T>(
  selector: (state: HomeBalanceProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return homeBalanceProjectionStore(selector);
}

export function useHome24hProjection<T>(
  selector: (state: Home24hProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return home24hProjectionStore(selector);
}

export function useHomeCurveProjection<T>(
  selector: (state: HomeCurveProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return homeCurveProjectionStore(selector);
}

export function useHomeRefreshProjection<T>(
  selector: (state: HomeRefreshProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return homeRefreshProjectionStore(selector);
}

export function useHomeContentReadinessProjection<T>(
  selector: (state: HomeContentReadinessProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return homeContentReadinessProjectionStore(selector);
}

export function getHomeAccountProjection() {
  ensureHomeProjectionLifecycle();
  return homeAccountProjectionStore.getState();
}

export function getHomeBalanceProjection() {
  ensureHomeProjectionLifecycle();
  return homeBalanceProjectionStore.getState();
}

export function getHome24hProjection() {
  ensureHomeProjectionLifecycle();
  return home24hProjectionStore.getState();
}

export function getHomeCurveProjection() {
  ensureHomeProjectionLifecycle();
  return homeCurveProjectionStore.getState();
}

export function getHomeRefreshProjection() {
  ensureHomeProjectionLifecycle();
  return homeRefreshProjectionStore.getState();
}

export function getHomeContentReadinessProjection() {
  ensureHomeProjectionLifecycle();
  return homeContentReadinessProjectionStore.getState();
}
