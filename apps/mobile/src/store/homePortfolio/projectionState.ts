import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  areHomeCurveProjectionsEqual,
  type HomeCurveProjection,
} from './curve';
import {
  areHome24hProjectionsEqual,
  areHomeBalanceProjectionsEqual,
  createInitialHomeAccountProjection,
  type Home24hProjection,
  type HomeAccountProjection,
  type HomeBalanceProjection,
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
import type { HomeProjectionSyncPlan } from './scheduler';

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

export type HomePortfolioProjectionState = {
  account: HomeAccountProjection;
  balance: HomeBalanceProjection;
  change24h: Home24hProjection;
  curve: HomeCurveProjection;
  refresh: HomeRefreshProjection;
  contentReadiness: HomeContentReadinessProjection;
};

export type HomePortfolioProjectionBuilders = {
  account: (previous: HomeAccountProjection) => HomeAccountProjection;
  balance: (account: HomeAccountProjection) => HomeBalanceProjection;
  change24h: (account: HomeAccountProjection) => Home24hProjection;
  curve: (account: HomeAccountProjection) => HomeCurveProjection;
};

export function createInitialHomePortfolioProjectionState(): HomePortfolioProjectionState {
  return {
    account: createInitialHomeAccountProjection(),
    balance: EMPTY_BALANCE_PROJECTION,
    change24h: EMPTY_24H_PROJECTION,
    curve: EMPTY_CURVE_PROJECTION,
    refresh: EMPTY_REFRESH_PROJECTION,
    contentReadiness: createInitialHomeContentReadinessProjection(),
  };
}

export function createHomePortfolioProjectionStore() {
  return createStore<HomePortfolioProjectionState>(() =>
    createInitialHomePortfolioProjectionState(),
  );
}

export function reduceHomePortfolioProjectionState(
  previous: HomePortfolioProjectionState,
  plan: HomeProjectionSyncPlan,
  builders: HomePortfolioProjectionBuilders,
): HomePortfolioProjectionState {
  const account = plan.account
    ? builders.account(previous.account)
    : previous.account;

  let balance = previous.balance;
  if (plan.balance) {
    const next = builders.balance(account);
    balance = areHomeBalanceProjectionsEqual(previous.balance, next)
      ? previous.balance
      : next;
  }

  let change24h = previous.change24h;
  if (plan.change24h) {
    const next = builders.change24h(account);
    change24h = areHome24hProjectionsEqual(previous.change24h, next)
      ? previous.change24h
      : next;
  }

  let curve = previous.curve;
  if (plan.curve) {
    const next = builders.curve(account);
    curve = areHomeCurveProjectionsEqual(previous.curve, next)
      ? previous.curve
      : next;
  }

  const nextRefresh = buildHomeRefreshProjection({
    balance,
    change24h,
    curve,
  });
  const refresh = areHomeRefreshProjectionsEqual(previous.refresh, nextRefresh)
    ? previous.refresh
    : nextRefresh;
  const contentReadiness = reduceHomeContentReadinessProjection(
    previous.contentReadiness,
    {
      account,
      balance,
      change24h,
    },
  );

  if (
    account === previous.account &&
    balance === previous.balance &&
    change24h === previous.change24h &&
    curve === previous.curve &&
    refresh === previous.refresh &&
    contentReadiness === previous.contentReadiness
  ) {
    return previous;
  }

  return {
    account,
    balance,
    change24h,
    curve,
    refresh,
    contentReadiness,
  };
}

export function syncHomePortfolioProjectionStore(
  store: Pick<StoreApi<HomePortfolioProjectionState>, 'setState'>,
  plan: HomeProjectionSyncPlan,
  builders: HomePortfolioProjectionBuilders,
) {
  store.setState(previous =>
    reduceHomePortfolioProjectionState(previous, plan, builders),
  );
}
