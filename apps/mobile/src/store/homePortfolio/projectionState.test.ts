import { buildHomeCurveProjection } from './curve';
import {
  buildHome24hProjection,
  buildHomeBalanceProjection,
  reduceHomeAccountProjection,
} from './model';
import {
  createHomePortfolioProjectionStore,
  syncHomePortfolioProjectionStore,
  type HomePortfolioProjectionBuilders,
} from './projectionState';

const ADDRESS = '0xaaa';
const CURVE_POINT = {
  value: 120,
  netWorth: '$120',
  change: '$20',
  rawChange: 20,
  isLoss: false,
  changePercent: '20.00%',
  timestamp: 1,
  dateString: 'date',
  clockTimeString: 'time',
  dateTimeString: 'datetime',
};

const builders: HomePortfolioProjectionBuilders = {
  account: previous =>
    reduceHomeAccountProjection(previous, {
      selectedAddresses: [ADDRESS],
      hasResolvedSelection: true,
      matteredAccountLength: 1,
      hasResolvedMatteredAccountLength: true,
      hasFetchedAccounts: true,
      isFetchingAccounts: false,
    }),
  balance: account =>
    buildHomeBalanceProjection({
      account,
      valueMap: {
        [ADDRESS]: { evmBalance: 120, totalBalance: 120 },
      },
    }),
  change24h: account =>
    buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS]: { evmBalance: 120, totalBalance: 120 },
      },
      previousBalanceMap: {
        [ADDRESS]: { total_usd_value: 100 },
      },
    }),
  curve: account =>
    buildHomeCurveProjection({
      account,
      sceneAddresses: [ADDRESS],
      list: [CURVE_POINT],
      curveValueMap: {
        [ADDRESS]: [{ timestamp: 1, usd_value: 120 }],
      },
      isSceneLoading: false,
      isSceneComputing: false,
    }),
};

const FULL_SYNC_PLAN = {
  account: true,
  balance: true,
  change24h: true,
  curve: true,
};

describe('home portfolio projection state', () => {
  it('publishes one coherent snapshot for a full projection sync', () => {
    const store = createHomePortfolioProjectionStore();
    const listener = jest.fn();
    store.subscribe(listener);

    syncHomePortfolioProjectionStore(store, FULL_SYNC_PLAN, builders);

    const state = store.getState();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(state.account).toMatchObject({
      addresses: [ADDRESS],
      selectionGeneration: 1,
    });
    expect(state.balance).toMatchObject({
      availability: 'ready',
      selectionGeneration: 1,
      value: { totalBalance: 120 },
    });
    expect(state.change24h).toMatchObject({
      availability: 'ready',
      selectionGeneration: 1,
      value: { rawChange: 20, changePercent: '20.00%' },
    });
    expect(state.curve).toMatchObject({
      availability: 'ready',
      selectionGeneration: 1,
    });
    expect(state.refresh.selectionGeneration).toBe(1);
    expect(state.contentReadiness).toMatchObject({
      isReady: true,
      settledSelectionGeneration: 1,
    });
  });

  it('reuses the root snapshot when every projection is unchanged', () => {
    const store = createHomePortfolioProjectionStore();
    syncHomePortfolioProjectionStore(store, FULL_SYNC_PLAN, builders);
    const previous = store.getState();
    const listener = jest.fn();
    store.subscribe(listener);

    syncHomePortfolioProjectionStore(store, FULL_SYNC_PLAN, builders);

    expect(store.getState()).toBe(previous);
    expect(listener).not.toHaveBeenCalled();
  });
});
