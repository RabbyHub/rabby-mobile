import { buildHomeCurveProjection } from './curve';
import {
  buildHome24hProjection,
  buildHomeBalanceProjection,
  createInitialHomeAccountProjection,
  reduceHomeAccountProjection,
} from './model';
import {
  createInitialHomeContentReadinessProjection,
  reduceHomeContentReadinessProjection,
} from './readiness';
import { buildHomeRefreshProjection } from './refresh';

const ADDRESS = '0xaaa';

function buildAccount() {
  return reduceHomeAccountProjection(createInitialHomeAccountProjection(), {
    selectedAddresses: [ADDRESS],
    hasResolvedSelection: true,
    matteredAccountLength: 1,
    hasResolvedMatteredAccountLength: true,
    hasFetchedAccounts: true,
    isFetchingAccounts: false,
  });
}

describe('home content readiness projection', () => {
  it('settles once values are available and never regresses during refresh', () => {
    const account = buildAccount();
    const balance = buildHomeBalanceProjection({
      account,
      valueMap: {
        [ADDRESS]: { evmBalance: 100, totalBalance: 100 },
      },
    });
    const change24h = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS]: { evmBalance: 100, totalBalance: 100 },
      },
      previousBalanceMap: {
        [ADDRESS]: { total_usd_value: 90 },
      },
    });
    const ready = reduceHomeContentReadinessProjection(
      createInitialHomeContentReadinessProjection(),
      { account, balance, change24h },
    );
    const refreshingBalance = buildHomeBalanceProjection({
      account,
      valueMap: {},
      flowMap: {
        [ADDRESS]: { isFetchingRemote: true },
      },
    });
    const afterRefreshStarts = reduceHomeContentReadinessProjection(ready, {
      account,
      balance: refreshingBalance,
      change24h,
    });

    expect(ready).toEqual({
      isReady: true,
      settledSelectionGeneration: account.selectionGeneration,
      blockingReasons: [],
    });
    expect(afterRefreshStarts).toBe(ready);
  });

  it('reports the exact projections blocking first content', () => {
    const account = buildAccount();
    const balance = buildHomeBalanceProjection({
      account,
      valueMap: {},
    });
    const change24h = buildHome24hProjection({
      account,
      currentBalanceMap: {},
      previousBalanceMap: {},
    });
    const projection = reduceHomeContentReadinessProjection(
      createInitialHomeContentReadinessProjection(),
      { account, balance, change24h },
    );

    expect(projection).toEqual({
      isReady: false,
      blockingReasons: ['balance', 'change_24h'],
    });
  });
});

describe('home refresh projection', () => {
  it('summarizes remote activity without changing value availability', () => {
    const account = buildAccount();
    const balance = buildHomeBalanceProjection({
      account,
      valueMap: {
        [ADDRESS]: { evmBalance: 100, totalBalance: 100 },
      },
      flowMap: {
        [ADDRESS]: { isFetchingRemote: true },
      },
    });
    const change24h = buildHome24hProjection({
      account,
      currentBalanceMap: {
        [ADDRESS]: { evmBalance: 100, totalBalance: 100 },
      },
      previousBalanceMap: {
        [ADDRESS]: { total_usd_value: 90 },
      },
    });
    const curve = buildHomeCurveProjection({
      account,
      sceneAddresses: [ADDRESS],
      list: [],
      curveValueMap: {},
      isSceneLoading: false,
      isSceneComputing: false,
    });
    const projection = buildHomeRefreshProjection({
      balance,
      change24h,
      curve,
    });

    expect(balance.availability).toBe('ready');
    expect(projection).toMatchObject({
      isBalanceFetchingRemote: true,
      is24hChangeFetchingRemote: false,
      isCurveFetchingRemote: false,
      isAnyRemoteRefreshing: true,
    });
  });
});
