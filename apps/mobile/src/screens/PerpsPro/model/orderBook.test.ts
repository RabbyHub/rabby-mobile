import type { L2Book, WsLevel } from '@rabby-wallet/hyperliquid-sdk';

import {
  calculatePerpsBuyRatio,
  getPerpTickOptions,
  getNextPerpsOrderBookMode,
  getPerpsOrderBookDisplayState,
  getPerpsOrderBookDepthPercent,
  getPerpsOrderBookModeIconTones,
  getPerpsOrderBookRowCount,
  getVisiblePerpsOrderBookMaxTotal,
  processPerpsOrderBook,
  resolvePerpsTickOption,
  selectVisiblePerpsOrderBookRows,
} from './orderBook';

const level = (px: string, sz: string): WsLevel => ({ n: 1, px, sz });

const book = (bids: WsLevel[], asks: WsLevel[], time = 100): L2Book => ({
  coin: 'BTC',
  levels: [bids, asks],
  time,
});

describe('Perps Pro order book model', () => {
  it('generates plugin-compatible tick options finest to coarsest', () => {
    expect(getPerpTickOptions(64000, 5)).toEqual([
      { displayPrice: 1, nSigFigs: 5, mantissa: null, priceDecimals: 0 },
      { displayPrice: 2, nSigFigs: 5, mantissa: 2, priceDecimals: 0 },
      { displayPrice: 5, nSigFigs: 5, mantissa: 5, priceDecimals: 0 },
      { displayPrice: 10, nSigFigs: 4, mantissa: null, priceDecimals: 0 },
      { displayPrice: 100, nSigFigs: 3, mantissa: null, priceDecimals: 0 },
      { displayPrice: 1000, nSigFigs: 2, mantissa: null, priceDecimals: 0 },
    ]);
    expect(getPerpTickOptions(0, 5)).toEqual([]);
  });

  it('filters tick options that exceed the size precision bound', () => {
    expect(getPerpTickOptions(0.59, 3).map(item => item.displayPrice)).toEqual([
      0.001, 0.01,
    ]);
  });

  it('validates persisted precision against current legal options', () => {
    const options = getPerpTickOptions(64000, 5);
    expect(
      resolvePerpsTickOption(options, { nSigFigs: 5, mantissa: 2 }),
    ).toEqual(options[1]);
    expect(
      resolvePerpsTickOption(options, { nSigFigs: 4, mantissa: 2 } as never),
    ).toEqual(options[0]);
  });

  it('processes best-first levels with base and quote cumulative totals', () => {
    const input = book(
      [level('100', '2'), level('99', '3')],
      [level('101', '4'), level('102', '5')],
    );
    const original = JSON.parse(JSON.stringify(input));
    const processed = processPerpsOrderBook(input);

    expect(processed.bids).toEqual([
      {
        price: '100',
        priceNumber: 100,
        size: 2,
        usdSize: 200,
        total: 2,
        totalUsd: 200,
      },
      {
        price: '99',
        priceNumber: 99,
        size: 3,
        usdSize: 297,
        total: 5,
        totalUsd: 497,
      },
    ]);
    expect(processed.asks[1]).toMatchObject({
      price: '102',
      total: 9,
      totalUsd: 914,
      usdSize: 510,
    });
    expect(processed.serverTime).toBe(100);
    expect(input).toEqual(original);
  });

  it('drops invalid and zero levels before accumulation', () => {
    const processed = processPerpsOrderBook(
      book(
        [
          level('bad', '2'),
          level('100', '0'),
          level('100', '-1'),
          level('100', '2'),
        ],
        [],
      ),
    );
    expect(processed.bids).toHaveLength(1);
    expect(processed.bids[0]?.total).toBe(2);
  });

  it('does not let an overflowing level poison later totals', () => {
    const processed = processPerpsOrderBook(
      book([level('1e308', '1e308'), level('100', '2')], []),
    );

    expect(processed.bids).toHaveLength(1);
    expect(processed.bids[0]).toMatchObject({
      price: '100',
      size: 2,
      total: 2,
      totalUsd: 200,
    });
    expect(calculatePerpsBuyRatio(processed)).toEqual({
      buy: 100,
      sell: 0,
    });
  });

  it('selects asks in visual reverse without changing their cumulative totals', () => {
    const processed = processPerpsOrderBook(
      book(
        [level('100', '1'), level('99', '2')],
        [level('101', '1'), level('102', '2')],
      ),
    );
    expect(
      selectVisiblePerpsOrderBookRows({
        book: processed,
        mode: 'both',
        rowCount: 2,
      }).asks.map(item => [item.price, item.total]),
    ).toEqual([
      ['102', 3],
      ['101', 1],
    ]);
    expect(
      selectVisiblePerpsOrderBookRows({
        book: processed,
        mode: 'bids',
        rowCount: 1,
      }),
    ).toEqual({ asks: [], bids: [processed.bids[0]] });
  });

  it('uses measured Figma row and middle heights', () => {
    expect(
      getPerpsOrderBookRowCount({
        containerHeight: 314,
        mode: 'both',
      }),
    ).toBe(6);
    expect(
      getPerpsOrderBookRowCount({
        containerHeight: 314,
        mode: 'asks',
      }),
    ).toBe(15);
    expect(
      getPerpsOrderBookRowCount({ containerHeight: 0, mode: 'both' }),
    ).toBe(6);
  });

  it('cycles the single mobile display control in plugin control order', () => {
    expect(getNextPerpsOrderBookMode('both')).toBe('bids');
    expect(getNextPerpsOrderBookMode('bids')).toBe('asks');
    expect(getNextPerpsOrderBookMode('asks')).toBe('both');
  });

  it('maps the five mode-icon cells to the approved mobile semantics', () => {
    expect(getPerpsOrderBookModeIconTones('both')).toEqual({
      left: ['neutral', 'neutral', 'neutral'],
      right: ['ask', 'bid'],
    });
    expect(getPerpsOrderBookModeIconTones('asks')).toEqual({
      left: ['ask', 'ask', 'ask'],
      right: ['neutral', 'neutral'],
    });
    expect(getPerpsOrderBookModeIconTones('bids')).toEqual({
      left: ['bid', 'bid', 'bid'],
      right: ['neutral', 'neutral'],
    });
  });

  it('keeps loading/reconnect on skeleton and terminal no-snapshot on unavailable', () => {
    expect(
      getPerpsOrderBookDisplayState({
        hasSnapshot: false,
        status: 'idle',
      }),
    ).toBe('skeleton');
    expect(
      getPerpsOrderBookDisplayState({
        hasSnapshot: false,
        status: 'loading',
      }),
    ).toBe('skeleton');
    expect(
      getPerpsOrderBookDisplayState({
        hasSnapshot: false,
        status: 'stale',
      }),
    ).toBe('skeleton');
    expect(
      getPerpsOrderBookDisplayState({
        hasSnapshot: false,
        status: 'error',
      }),
    ).toBe('unavailable');
    expect(
      getPerpsOrderBookDisplayState({
        hasSnapshot: true,
        status: 'stale',
      }),
    ).toBe('content');
  });

  it('normalizes depth to the largest visible cumulative base amount', () => {
    const processed = processPerpsOrderBook(
      book([level('100', '2')], [level('101', '4')]),
    );
    const visible = selectVisiblePerpsOrderBookRows({
      book: processed,
      mode: 'both',
      rowCount: 1,
    });
    const max = getVisiblePerpsOrderBookMaxTotal(visible);
    expect(max).toBe(4);
    expect(getPerpsOrderBookDepthPercent(visible.bids[0]!, max)).toBe(50);
    expect(getPerpsOrderBookDepthPercent(visible.asks[0]!, max)).toBe(100);
  });

  it('calculates Buy Ratio from the complete quote notional book', () => {
    const processed = processPerpsOrderBook(
      book([level('100', '3')], [level('100', '1')]),
    );
    expect(calculatePerpsBuyRatio(processed)).toEqual({
      buy: 75,
      sell: 25,
    });
    expect(calculatePerpsBuyRatio(processPerpsOrderBook(null))).toEqual({
      buy: 0,
      sell: 0,
    });
  });
});
