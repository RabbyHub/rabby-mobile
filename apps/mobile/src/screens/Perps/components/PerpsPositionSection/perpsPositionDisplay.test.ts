import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import type {
  MarketData,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import {
  createPerpsPositionMarketSelector,
  getPerpsPositionRows,
  type PerpsPositionMarketDisplay,
} from './perpsPositionDisplay';

const market = (name: string): MarketData => ({
  index: 0,
  name,
  displayName: name,
  logoUrl: 'https://example.invalid/coin.png',
  quoteAsset: 'USDC',
  maxLeverage: 20,
  minLeverage: 1,
  maxUsdValueSize: '100000',
  maintenanceMarginTiers: [],
  szDecimals: 4,
  pxDecimals: 2,
  dayBaseVlm: '100',
  dayNtlVlm: '1000',
  funding: '0',
  markPx: '100',
  midPx: '101',
  openInterest: '200',
  oraclePx: '100',
  premium: '0',
  prevDayPx: '95',
  dexId: '',
});
const order = (coin: string, oid: number): OpenOrder => ({
  coin,
  oid,
  side: 'B',
  limitPx: '100',
  sz: '1',
  timestamp: 1,
  triggerCondition: 'Above',
  isTrigger: true,
  triggerPx: '110',
  isPositionTpsl: true,
  reduceOnly: true,
  orderType: 'Take Profit Market',
  origSz: '1',
  tif: 'Gtc',
});
const position = (coin: string, marginUsed: string): PositionAndOpenOrder => ({
  type: 'oneWay',
  position: {
    coin,
    cumFunding: { allTime: '1', sinceChange: '2', sinceOpen: '3' },
    entryPx: '100',
    leverage: { type: 'cross', value: 5 },
    liquidationPx: '80',
    marginUsed,
    maxLeverage: 20,
    positionValue: '100',
    returnOnEquity: '0.1',
    szi: '1',
    unrealizedPnl: '2',
  },
  openOrders: [
    { ...order(coin, 3), children: [order(coin, 9)] },
    order(coin, 1),
  ],
});

describe('Perps position market display selector', () => {
  it('projects exactly the five display fields and reuses equal snapshots', () => {
    const select = createPerpsPositionMarketSelector('BTC');
    const btc = market('BTC');
    const first = select({ marketDataMap: { BTC: btc } });
    expect(first).toEqual({
      logoUrl: btc.logoUrl,
      markPx: btc.markPx,
      displayName: btc.displayName,
      name: btc.name,
      quoteAsset: btc.quoteAsset,
    });
    expect(select({ marketDataMap: { BTC: { ...btc } } })).toBe(first);
  });

  it.each<Partial<PerpsPositionMarketDisplay>>([
    { logoUrl: 'https://example.invalid/new.png' },
    { markPx: '102' },
    { displayName: 'Bitcoin' },
    { name: 'xyz:BTC' },
    { quoteAsset: 'USDH' },
  ])('publishes each consumed field change immediately: %j', change => {
    const select = createPerpsPositionMarketSelector('BTC');
    const btc = market('BTC');
    const first = select({ marketDataMap: { BTC: btc } });
    const next = select({ marketDataMap: { BTC: { ...btc, ...change } } });
    expect(next).not.toBe(first);
    expect(next).toEqual({ ...first, ...change });
    expect(select({ marketDataMap: { BTC: { ...btc, ...change } } })).toBe(
      next,
    );
  });

  it('ignores other coins and unconsumed fields of its own market', () => {
    const select = createPerpsPositionMarketSelector('BTC');
    const btc = market('BTC');
    const first = select({ marketDataMap: { BTC: btc, ETH: market('ETH') } });
    expect(
      select({
        marketDataMap: {
          BTC: {
            ...btc,
            midPx: '999',
            funding: '0.5',
            dayNtlVlm: '3000',
            openInterest: '900',
            pxDecimals: 4,
          },
          ETH: { ...market('ETH'), markPx: '888' },
        },
      }),
    ).toBe(first);
  });

  it('preserves missing markets and does not serve a stale projection after removal', () => {
    const select = createPerpsPositionMarketSelector('BTC');
    expect(select({ marketDataMap: {} })).toBeUndefined();
    const btc = market('BTC');
    const first = select({ marketDataMap: { BTC: btc } });
    expect(first?.markPx).toBe('100');
    expect(select({ marketDataMap: { ETH: market('ETH') } })).toBeUndefined();
    expect(select({ marketDataMap: {} })).toBeUndefined();
    expect(
      select({ marketDataMap: { BTC: { ...btc, markPx: '105' } } }),
    ).toEqual({ ...first, markPx: '105' });
  });

  it('preserves empty display fields for the renderer fallback rules', () => {
    const select = createPerpsPositionMarketSelector('BTC');
    const btc = { ...market('BTC'), name: '', displayName: '', logoUrl: '' };
    expect(select({ marketDataMap: { BTC: btc } })).toMatchObject({
      name: '',
      displayName: '',
      logoUrl: '',
    });
  });

  it('selects the exact canonical coin, preserving case and dex prefixes', () => {
    const marketDataMap = Object.fromEntries(
      ['BTC', 'btc', 'xyz:BTC'].map((name, index) => [
        name,
        { ...market(name), markPx: String(index + 1) },
      ]),
    );
    for (const [index, coin] of ['BTC', 'btc', 'xyz:BTC'].entries()) {
      expect(
        createPerpsPositionMarketSelector(coin)({ marketDataMap }),
      ).toMatchObject({ name: coin, markPx: String(index + 1) });
    }
  });
});

describe('Perps position display rows', () => {
  it('accepts missing and empty positions', () => {
    expect(getPerpsPositionRows()).toEqual([]);
    expect(getPerpsPositionRows([])).toEqual([]);
  });

  it('sorts numeric margin descending with stable ties and preserves all row/order payloads', () => {
    const low = position('BTC', '2');
    const high = position('ETH', '10');
    const tied = position('xyz:BTC', '10');
    const positions = [low, high, tied];
    const before = JSON.parse(JSON.stringify(positions));
    const rows = getPerpsPositionRows(positions);
    expect(rows.map(entry => entry.row)).toEqual([high, tied, low]);
    expect(rows[0].row).toBe(high);
    expect(rows[1].row).toBe(tied);
    expect(rows[2].row).toBe(low);
    expect(rows[2].row.openOrders).toBe(low.openOrders);
    expect(rows[2].row.openOrders.map(item => item.oid)).toEqual([3, 1]);
    expect(rows[2].row.openOrders[0].children).toBe(low.openOrders[0].children);
    expect(positions).toEqual(before);
    expect(positions[0]).toBe(low);
  });

  it('keeps duplicate rows with unambiguous exact-coin occurrence keys', () => {
    const positions = ['BTC', 'btc', 'BTC', 'xyz:BTC', '__proto__'].map(coin =>
      position(coin, '10'),
    );
    const rows = getPerpsPositionRows(positions);
    expect(rows.map(entry => entry.row)).toEqual(positions);
    expect(rows.map(entry => entry.key)).toEqual([
      JSON.stringify(['BTC', 0]),
      JSON.stringify(['btc', 0]),
      JSON.stringify(['BTC', 1]),
      JSON.stringify(['xyz:BTC', 0]),
      JSON.stringify(['__proto__', 0]),
    ]);
    expect(new Set(rows.map(entry => entry.key)).size).toBe(positions.length);
  });

  it('keeps unique-coin keys attached to their row when margin changes reorder the section', () => {
    const btc = position('BTC', '2');
    const eth = position('ETH', '10');
    const first = getPerpsPositionRows([btc, eth]);
    const updatedBtc = {
      ...btc,
      position: { ...btc.position, marginUsed: '20' },
    };
    const next = getPerpsPositionRows([updatedBtc, eth]);
    expect(next.map(entry => entry.row.position.coin)).toEqual(['BTC', 'ETH']);
    expect(next[0].key).toBe(first[1].key);
    expect(next[1].key).toBe(first[0].key);
    expect(next[0].row).toBe(updatedBtc);
    expect(next[1].row).toBe(eth);
  });
});
