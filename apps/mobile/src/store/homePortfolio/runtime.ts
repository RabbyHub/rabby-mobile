import { filterMyAccounts } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import accountStore from '@/store/account';
import addressBalanceStore, { balanceAccountsStore } from '@/store/balance';
import { balance24hStore, scene24hBalanceStore } from '@/store/balance24h';
import type { ResourceFlowState } from '@/store/_resourceBase';
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

const EMPTY_BALANCE_PROJECTION: HomeBalanceProjection = {
  availability: 'unresolved',
  selectionSignature: '',
  selectionGeneration: 0,
  sourceAddresses: [],
  missingAddresses: [],
  activity: {
    isHydrating: false,
    isFetchingRemote: false,
    isComputing: false,
    isActive: false,
    activeAddresses: [],
  },
};

const EMPTY_24H_PROJECTION: Home24hProjection = {
  availability: 'unresolved',
  selectionSignature: '',
  selectionGeneration: 0,
  sourceAddresses: [],
  missingAddresses: [],
  activity: {
    isHydrating: false,
    isFetchingRemote: false,
    isComputing: false,
    isActive: false,
    activeAddresses: [],
  },
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
  const next = buildHome24hProjection({
    account,
    currentBalanceMap: addressBalanceStore.getAddressValueMap(),
    previousBalanceMap: balance24hStore.getAddress24hBalanceMap(),
    currentFlowMap: buildFlowMap(
      account.addresses,
      addressBalanceStore.getAddressFlowState,
    ),
    previousFlowMap: buildFlowMap(
      account.addresses,
      balance24hStore.getAddress24hBalanceFlowState,
    ),
    isComputing: isCurrentSelectionComputing,
  });

  home24hProjectionStore.setState(previous =>
    areHome24hProjectionsEqual(previous, next) ? previous : next,
  );
}

function syncSelectionDependentProjections() {
  syncHomeAccountProjection();
  syncHomeBalanceProjection();
  syncHome24hProjection();
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
  });
  balance24hStore.subscribe(syncHome24hProjection);
  scene24hBalanceStore.subscribe(syncHome24hProjection);

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
