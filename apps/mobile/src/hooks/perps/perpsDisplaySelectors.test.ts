import type { AssetPosition, OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import type { PerpsState } from './usePerpsStore';
import {
  createPerpsLegacyDisplaySelector,
  createPerpsSimpleDisplaySelector,
} from './perpsDisplaySelectors';

const position = (coin: string): AssetPosition => ({
  type: 'oneWay',
  position: {
    coin,
    cumFunding: { allTime: '1', sinceChange: '2', sinceOpen: '3' },
    entryPx: '100',
    leverage: { type: 'cross', value: 5 },
    liquidationPx: '80',
    marginUsed: '20',
    maxLeverage: 20,
    positionValue: '100',
    returnOnEquity: '0.1',
    szi: '1',
    unrealizedPnl: '2',
  },
});
const order = (coin: string, oid: number): OpenOrder => ({
  coin,
  oid,
  side: 'B',
  limitPx: '100',
  sz: '1',
  timestamp: 1,
  triggerCondition: '',
  isTrigger: false,
  triggerPx: '0',
  isPositionTpsl: false,
  reduceOnly: false,
  orderType: 'Limit',
  origSz: '1',
  tif: 'Gtc',
  cloid: null,
});
const clearinghouse = (
  assetPositions: AssetPosition[],
  time = 1,
): NonNullable<PerpsState['currentClearinghouseState']> => ({
  assetPositions,
  time,
  withdrawable: '1',
  crossMaintenanceMarginUsed: '0',
  marginSummary: {
    accountValue: '1',
    totalMarginUsed: '0',
    totalNtlPos: '0',
    totalRawUsd: '1',
  },
  crossMarginSummary: {
    accountValue: '1',
    totalMarginUsed: '0',
    totalNtlPos: '0',
    totalRawUsd: '1',
  },
  crossMaintByDex: {},
  perDexSummaries: {},
});
const source = () => ({
  isInitialized: true,
  isLogin: true,
  hasPermission: true,
  currentClearinghouseState: clearinghouse([]),
  openOrders: [] as OpenOrder[],
  userFills: [],
  userAccountHistory: [],
  localLoadingHistory: [],
  favoriteMarkets: [] as string[],
  perpFee: 0,
});
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('Perps Simple display selector', () => {
  it('publishes only flags and positions, keeping empty snapshots stable across unrelated writes', () => {
    const select = createPerpsSimpleDisplaySelector();
    const state = source();
    const first = select(state);
    expect(first).toEqual({
      isInitialized: true,
      isLogin: true,
      hasPermission: true,
      positionAndOpenOrders: [],
    });
    expect(
      select({
        ...state,
        currentClearinghouseState: clearinghouse([], 2),
        openOrders: [order('BTC', 1)],
        favoriteMarkets: ['BTC'],
        perpFee: 1,
      }),
    ).toBe(first);
    expect(select({ ...state, currentClearinghouseState: null })).toBe(first);
    expect(select({ ...state, hasPermission: false })).toEqual({
      ...first,
      hasPermission: false,
    });
  });

  it('matches the legacy join exactly, including ordering, case, duplicate positions and nested orders', () => {
    const select = createPerpsSimpleDisplaySelector();
    const state = {
      ...source(),
      currentClearinghouseState: clearinghouse([
        position('ETH'),
        position('BTC'),
        position('BTC'),
        position('xyz:BTC'),
        position('__proto__'),
      ]),
      openOrders: [
        order('BTC', 3),
        order('eth', 4),
        { ...order('ETH', 1), children: [order('ETH', 9)] },
        order('xyz:BTC', 6),
        order('__proto__', 7),
        order('BTC', 2),
      ],
    };
    const before = clone(state);
    const expected = state.currentClearinghouseState.assetPositions.map(
      item => ({
        ...item,
        openOrders: state.openOrders.filter(
          candidate => candidate.coin === item.position.coin,
        ),
      }),
    );
    const first = select(state);
    expect(first.positionAndOpenOrders).toEqual(expected);
    expect(select(clone(state))).toBe(first);
    expect(state).toEqual(before);
    const reordered = select({
      ...state,
      openOrders: [...state.openOrders].reverse(),
    });
    expect(
      reordered.positionAndOpenOrders[1].openOrders.map(item => item.oid),
    ).toEqual([2, 3]);
    const positionReorder = select({
      ...state,
      currentClearinghouseState: clearinghouse(
        [...state.currentClearinghouseState.assetPositions].reverse(),
      ),
    });
    expect(
      positionReorder.positionAndOpenOrders.map(item => item.position.coin),
    ).toEqual(['__proto__', 'xyz:BTC', 'BTC', 'BTC', 'ETH']);
  });

  it.each([
    { entryPx: '101' },
    { liquidationPx: undefined },
    { marginUsed: '21' },
    { maxLeverage: 25 },
    { positionValue: '102' },
    { returnOnEquity: '0.2' },
    { szi: '-1' },
    { unrealizedPnl: '3' },
    { cumFunding: { allTime: '1', sinceChange: '2', sinceOpen: '4' } },
    { leverage: { type: 'isolated' as const, value: 3, rawUsd: '7' } },
    { futurePositionField: { value: 'new' } },
  ])(
    'immediately publishes every changed position field without rebuilding unaffected rows: %j',
    change => {
      const select = createPerpsSimpleDisplaySelector();
      const btc = position('BTC');
      const eth = position('ETH');
      const state = {
        ...source(),
        currentClearinghouseState: clearinghouse([btc, eth]),
        openOrders: [order('BTC', 1)],
      };
      const first = select(state);
      const changed = { ...btc, position: { ...btc.position, ...change } };
      const next = select({
        ...state,
        currentClearinghouseState: clearinghouse([changed, eth]),
      });
      expect(next).not.toBe(first);
      expect(next.positionAndOpenOrders[0].position).toEqual(changed.position);
      expect(next.positionAndOpenOrders[1]).toBe(
        first.positionAndOpenOrders[1],
      );
    },
  );

  it.each([
    { sz: '2' },
    { side: 'A' as const },
    { limitPx: '101' },
    { timestamp: 2 },
    { reduceOnly: true },
    { isPositionTpsl: true },
    { isTrigger: true, triggerPx: '105', triggerCondition: 'Above' },
    { orderType: 'Stop Market', tif: null, cloid: 'new' },
    { children: [order('BTC', 20)] },
    { futureOrderField: 'new' },
  ])(
    'preserves changes in the complete associated order payload: %j',
    change => {
      const select = createPerpsSimpleDisplaySelector();
      const state = {
        ...source(),
        currentClearinghouseState: clearinghouse([position('BTC')]),
        openOrders: [order('BTC', 1)],
      };
      const first = select(state);
      const changed = { ...state.openOrders[0], ...change };
      const next = select({ ...state, openOrders: [changed] });
      expect(next).not.toBe(first);
      expect(next.positionAndOpenOrders[0].openOrders).toEqual([changed]);
    },
  );

  it('ignores orders for other coins but publishes association removal and new positions', () => {
    const select = createPerpsSimpleDisplaySelector();
    const state = {
      ...source(),
      currentClearinghouseState: clearinghouse([position('BTC')]),
      openOrders: [order('BTC', 1)],
    };
    const first = select(state);
    expect(
      select({ ...state, openOrders: [...state.openOrders, order('ETH', 2)] }),
    ).toBe(first);
    expect(
      select({ ...state, openOrders: [] }).positionAndOpenOrders[0].openOrders,
    ).toEqual([]);
    expect(
      select({ ...state, currentClearinghouseState: clearinghouse([]) })
        .positionAndOpenOrders,
    ).toEqual([]);
    expect(select(state).positionAndOpenOrders).toEqual(
      first.positionAndOpenOrders,
    );
  });

  it('leaves the legacy snapshot and its broad field updates available', () => {
    const select = createPerpsLegacyDisplaySelector();
    const state = source();
    const first = select(state);
    expect(first).toEqual({ ...state, positionAndOpenOrders: [] });
    const favoriteMarkets = ['BTC'];
    expect(select({ ...state, favoriteMarkets }).favoriteMarkets).toBe(
      favoriteMarkets,
    );
    expect(select({ ...state, favoriteMarkets }).positionAndOpenOrders).toBe(
      first.positionAndOpenOrders,
    );
  });
});
