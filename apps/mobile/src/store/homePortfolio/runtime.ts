import { filterMyAccounts } from '@/core/apis/account';
import { getHomeAssetSelectionSettings } from '@/hooks/appSettings';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import accountStore from '@/store/account';
import addressBalanceStore, { balanceAccountsStore } from '@/store/balance';
import { balance24hStore, scene24hBalanceStore } from '@/store/balance24h';
import { addressCurve24hStore, sceneCurve24hStore } from '@/store/curve24h';
import type { ResourceFlowState } from '@/store/_resourceBase';
import { didResourceLoadingStateChange } from '@/store/_resourceFlow';
import { buildHomeCurveProjection, type HomeCurveProjection } from './curve';
import {
  buildHome24hProjection,
  buildHomeBalanceProjection,
  getHomeSelectionSignature,
  reduceHomeAccountProjection,
  type Home24hProjection,
  type HomeAccountProjection,
  type HomeBalanceProjection,
  type HomeProjectionResourceFlow,
} from './model';
import { type HomeRefreshProjection } from './refresh';
import type { HomeContentReadinessProjection } from './readiness';
import {
  createHomePortfolioProjectionStore,
  syncHomePortfolioProjectionStore,
  type HomePortfolioProjectionBuilders,
  type HomePortfolioProjectionState,
} from './projectionState';
import {
  createHomeProjectionScheduler,
  type HomeProjectionSyncPlan,
} from './scheduler';

const homePortfolioProjectionStore = createHomePortfolioProjectionStore();

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

function buildNextHomeAccountProjection(previous: HomeAccountProjection) {
  const balanceState = balanceAccountsStore.getState();
  const accountsState = accountStore.getState();
  const canUseFetchedAccountLength =
    !balanceState.hasResolvedMatteredAccountLength &&
    accountsState.hasFetchedAccounts;

  return reduceHomeAccountProjection(previous, {
    selectedAddresses: balanceState.selectedAddresses,
    hasResolvedSelection: balanceState.hasResolvedSelection,
    matteredAccountLength: canUseFetchedAccountLength
      ? getHomeAssetSelectionSettings().includeWatchAddresses
        ? accountsState.accounts.length
        : filterMyAccounts(accountsState.accounts).length
      : balanceState.matteredAccountLength,
    hasResolvedMatteredAccountLength:
      balanceState.hasResolvedMatteredAccountLength ||
      canUseFetchedAccountLength,
    hasFetchedAccounts: accountsState.hasFetchedAccounts,
    isFetchingAccounts: accountsState.isFetchingAccounts,
  });
}

function buildNextHomeBalanceProjection(account: HomeAccountProjection) {
  return buildHomeBalanceProjection({
    account,
    valueMap: addressBalanceStore.getAddressValueMap(),
    flowMap: buildFlowMap(
      account.addresses,
      addressBalanceStore.getAddressFlowState,
    ),
  });
}

function buildNextHome24hProjection(account: HomeAccountProjection) {
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

  return buildHome24hProjection({
    account,
    currentBalanceMap: addressBalanceStore.getAddressValueMap(),
    previousBalanceMap: balance24hStore.getAddress24hBalanceMap(),
    currentFlowMap,
    previousFlowMap,
    isComputing: isCurrentSelectionComputing,
  });
}

function buildNextHomeCurveProjection(account: HomeAccountProjection) {
  const sceneState = sceneCurve24hStore.getState();
  return buildHomeCurveProjection({
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
}

const homeProjectionBuilders: HomePortfolioProjectionBuilders = {
  account: buildNextHomeAccountProjection,
  balance: buildNextHomeBalanceProjection,
  change24h: buildNextHome24hProjection,
  curve: buildNextHomeCurveProjection,
};

function flushHomeProjectionSyncPlan(plan: HomeProjectionSyncPlan) {
  syncHomePortfolioProjectionStore(
    homePortfolioProjectionStore,
    plan,
    homeProjectionBuilders,
  );
}

const homeProjectionScheduler = createHomeProjectionScheduler({
  onFlush: flushHomeProjectionSyncPlan,
});

let hasStartedHomeProjectionLifecycle = false;

export function ensureHomeProjectionLifecycle() {
  if (hasStartedHomeProjectionLifecycle) {
    return;
  }

  hasStartedHomeProjectionLifecycle = true;

  balanceAccountsStore.subscribe(() => {
    homeProjectionScheduler.schedule('account');
  });
  accountStore.subscribe(() => {
    homeProjectionScheduler.schedule('account');
  });
  addressBalanceStore.subscribe((state, previousState) => {
    const addresses = homePortfolioProjectionStore.getState().account.addresses;
    if (
      state.valueMap === previousState.valueMap &&
      !didResourceLoadingStateChange(
        previousState.metaMap,
        state.metaMap,
        addresses,
      )
    ) {
      return;
    }

    homeProjectionScheduler.schedule('balance', 'change24h');
  });
  balance24hStore.subscribe(() => {
    homeProjectionScheduler.schedule('change24h');
  });
  scene24hBalanceStore.subscribe(() => {
    homeProjectionScheduler.schedule('change24h');
  });
  addressCurve24hStore.subscribe(() => {
    homeProjectionScheduler.schedule('curve');
  });
  sceneCurve24hStore.subscribe(() => {
    homeProjectionScheduler.schedule('curve');
  });

  homeProjectionScheduler.flushNow('account');
}

export function useHomeAccountProjection<T>(
  selector: (state: HomeAccountProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(
    homePortfolioProjectionStore,
    state => selector(state.account),
    Object.is,
    { storeLabel: 'home-portfolio-projections' },
  );
}

export function useHomePortfolioProjection<T>(
  selector: (state: HomePortfolioProjectionState) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(homePortfolioProjectionStore, selector, Object.is, {
    storeLabel: 'home-portfolio-projections',
  });
}

export function useHomeBalanceProjection<T>(
  selector: (state: HomeBalanceProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(
    homePortfolioProjectionStore,
    state => selector(state.balance),
    Object.is,
    { storeLabel: 'home-portfolio-projections' },
  );
}

export function useHome24hProjection<T>(
  selector: (state: Home24hProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(
    homePortfolioProjectionStore,
    state => selector(state.change24h),
    Object.is,
    { storeLabel: 'home-portfolio-projections' },
  );
}

export function useHomeCurveProjection<T>(
  selector: (state: HomeCurveProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(
    homePortfolioProjectionStore,
    state => selector(state.curve),
    Object.is,
    { storeLabel: 'home-portfolio-projections' },
  );
}

export function useHomeRefreshProjection<T>(
  selector: (state: HomeRefreshProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(
    homePortfolioProjectionStore,
    state => selector(state.refresh),
    Object.is,
    { storeLabel: 'home-portfolio-projections' },
  );
}

export function useHomeContentReadinessProjection<T>(
  selector: (state: HomeContentReadinessProjection) => T,
) {
  ensureHomeProjectionLifecycle();
  return useActivityStore(
    homePortfolioProjectionStore,
    state => selector(state.contentReadiness),
    Object.is,
    { storeLabel: 'home-portfolio-projections' },
  );
}

export function getHomeAccountProjection() {
  ensureHomeProjectionLifecycle();
  return homePortfolioProjectionStore.getState().account;
}

export function getHomeBalanceProjection() {
  ensureHomeProjectionLifecycle();
  return homePortfolioProjectionStore.getState().balance;
}

export function getHome24hProjection() {
  ensureHomeProjectionLifecycle();
  return homePortfolioProjectionStore.getState().change24h;
}

export function getHomeCurveProjection() {
  ensureHomeProjectionLifecycle();
  return homePortfolioProjectionStore.getState().curve;
}

export function getHomeRefreshProjection() {
  ensureHomeProjectionLifecycle();
  return homePortfolioProjectionStore.getState().refresh;
}

export function getHomeContentReadinessProjection() {
  ensureHomeProjectionLifecycle();
  return homePortfolioProjectionStore.getState().contentReadiness;
}
