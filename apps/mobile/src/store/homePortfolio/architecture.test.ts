import { buildHomeCurveProjection } from './curve';
import {
  areHome24hProjectionsEqual,
  areHomeBalanceProjectionsEqual,
  buildHome24hProjection,
  buildHomeBalanceProjection,
  createInitialHomeAccountProjection,
  reduceHomeAccountProjection,
  type HomeAccountProjection,
} from './model';
import {
  createInitialHomeContentReadinessProjection,
  reduceHomeContentReadinessProjection,
} from './readiness';
import { buildHomeRefreshProjection } from './refresh';

const ADDRESS_A = '0xaaa';
const ADDRESS_B = '0xbbb';
const ADDRESS_C = '0xccc';

const CURVE_POINT = {
  value: 175,
  netWorth: '$175',
  change: '$25',
  rawChange: 25,
  isLoss: false,
  changePercent: '16.67%',
  timestamp: 1,
  dateString: 'date',
  clockTimeString: 'time',
  dateTimeString: 'datetime',
};

function selectAccounts(
  addresses: string[],
  previous: HomeAccountProjection = createInitialHomeAccountProjection(),
) {
  return reduceHomeAccountProjection(previous, {
    selectedAddresses: addresses,
    hasResolvedSelection: true,
    matteredAccountLength: addresses.length,
    hasResolvedMatteredAccountLength: true,
    hasFetchedAccounts: true,
    isFetchingAccounts: false,
  });
}

function balance(totalBalance: number) {
  return { evmBalance: totalBalance, totalBalance };
}

describe('home portfolio projection architecture', () => {
  it('converges independent projections across account removal and promotion', () => {
    const initialAccount = selectAccounts([ADDRESS_A, ADDRESS_B]);
    const initialBalance = buildHomeBalanceProjection({
      account: initialAccount,
      valueMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_B]: balance(80),
      },
    });
    const initial24h = buildHome24hProjection({
      account: initialAccount,
      currentBalanceMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_B]: balance(80),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_B]: { total_usd_value: 100 },
      },
    });
    const initialReadiness = reduceHomeContentReadinessProjection(
      createInitialHomeContentReadinessProjection(),
      {
        account: initialAccount,
        balance: initialBalance,
        change24h: initial24h,
      },
    );

    const promotedAccount = selectAccounts(
      [ADDRESS_A, ADDRESS_C],
      initialAccount,
    );
    const partialBalance = buildHomeBalanceProjection({
      account: promotedAccount,
      valueMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_B]: balance(80),
      },
      flowMap: {
        [ADDRESS_C]: { isFetchingRemote: true },
      },
    });
    const partial24h = buildHome24hProjection({
      account: promotedAccount,
      currentBalanceMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_B]: balance(80),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_B]: { total_usd_value: 100 },
      },
      previousFlowMap: {
        [ADDRESS_C]: { isFetchingRemote: true },
      },
    });
    const staleCurve = buildHomeCurveProjection({
      account: promotedAccount,
      sceneAddresses: [ADDRESS_A, ADDRESS_B],
      list: [CURVE_POINT],
      curveValueMap: {
        [ADDRESS_A]: [{ timestamp: 1, usd_value: 120 }],
        [ADDRESS_B]: [{ timestamp: 1, usd_value: 80 }],
      },
      isSceneLoading: false,
      isSceneComputing: false,
    });
    const refresh = buildHomeRefreshProjection({
      balance: partialBalance,
      change24h: partial24h,
      curve: staleCurve,
    });
    const readinessDuringPromotion = reduceHomeContentReadinessProjection(
      initialReadiness,
      {
        account: promotedAccount,
        balance: partialBalance,
        change24h: partial24h,
      },
    );

    expect(initialReadiness.isReady).toBe(true);
    expect(promotedAccount.selectionGeneration).toBe(
      initialAccount.selectionGeneration + 1,
    );
    expect(partialBalance).toMatchObject({
      availability: 'partial',
      sourceAddresses: [ADDRESS_A],
      missingAddresses: [ADDRESS_C],
      value: { totalBalance: 120 },
    });
    expect(partial24h).toMatchObject({
      availability: 'partial',
      sourceAddresses: [ADDRESS_A],
      missingAddresses: [ADDRESS_C],
      value: { rawChange: 20, changePercent: '20.00%' },
    });
    expect(staleCurve).toMatchObject({
      availability: 'loading',
      value: undefined,
    });
    expect(refresh.isAnyRemoteRefreshing).toBe(true);
    expect(readinessDuringPromotion).toBe(initialReadiness);

    const balanceAfterDeletedAddressReturns = buildHomeBalanceProjection({
      account: promotedAccount,
      valueMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_B]: balance(999),
      },
      flowMap: {
        [ADDRESS_C]: { isFetchingRemote: true },
      },
    });
    const changeAfterDeletedAddressReturns = buildHome24hProjection({
      account: promotedAccount,
      currentBalanceMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_B]: balance(999),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_B]: { total_usd_value: 1 },
      },
      previousFlowMap: {
        [ADDRESS_C]: { isFetchingRemote: true },
      },
    });

    expect(
      areHomeBalanceProjectionsEqual(
        partialBalance,
        balanceAfterDeletedAddressReturns,
      ),
    ).toBe(true);
    expect(
      areHome24hProjectionsEqual(partial24h, changeAfterDeletedAddressReturns),
    ).toBe(true);

    const settledBalance = buildHomeBalanceProjection({
      account: promotedAccount,
      valueMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_C]: balance(55),
      },
    });
    const settled24h = buildHome24hProjection({
      account: promotedAccount,
      currentBalanceMap: {
        [ADDRESS_A]: balance(120),
        [ADDRESS_C]: balance(55),
      },
      previousBalanceMap: {
        [ADDRESS_A]: { total_usd_value: 100 },
        [ADDRESS_C]: { total_usd_value: 50 },
      },
    });
    const settledCurve = buildHomeCurveProjection({
      account: promotedAccount,
      sceneAddresses: [ADDRESS_C, ADDRESS_A],
      list: [CURVE_POINT],
      curveValueMap: {
        [ADDRESS_A]: [{ timestamp: 1, usd_value: 120 }],
        [ADDRESS_C]: [{ timestamp: 1, usd_value: 55 }],
      },
      isSceneLoading: false,
      isSceneComputing: false,
    });

    expect(settledBalance).toMatchObject({
      availability: 'ready',
      value: { totalBalance: 175 },
    });
    expect(settled24h).toMatchObject({
      availability: 'ready',
      value: { rawChange: 25, changePercent: '16.67%' },
    });
    expect(settledCurve).toMatchObject({
      availability: 'ready',
      value: { list: [CURVE_POINT] },
    });
  });

  it('treats order-only changes as the same aggregate selection', () => {
    const initial = selectAccounts([ADDRESS_A, ADDRESS_B]);
    const reordered = selectAccounts([ADDRESS_B, ADDRESS_A], initial);

    expect(reordered).toBe(initial);
  });
});
