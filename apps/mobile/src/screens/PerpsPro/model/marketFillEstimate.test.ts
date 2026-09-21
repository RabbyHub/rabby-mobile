import type { L2Book, WsLevel } from '@rabby-wallet/hyperliquid-sdk';

import { estimatePerpsProMarketFill } from './marketFillEstimate';

const level = (px: string, sz: string): WsLevel => ({ n: 1, px, sz });
const book = (bids: WsLevel[], asks: WsLevel[]): L2Book => ({
  coin: 'BTC',
  levels: [bids, asks],
  time: 100,
});
const snapshot = book(
  [level('99', '1'), level('98', '2')],
  [level('101', '1'), level('102', '2')],
);

describe('estimatePerpsProMarketFill', () => {
  it('uses asks for Buy and returns a multi-level VWAP', () => {
    expect(
      estimatePerpsProMarketFill({
        amount: '2',
        amountUnit: 'base',
        book: snapshot,
        coin: 'BTC',
        sessionKey: 'BTC:1',
        side: 'buy',
        status: 'ready',
        szDecimals: 2,
      }),
    ).toEqual({
      estimate: {
        baseSize: '2',
        bookTime: 100,
        expectedEntryPrice: '101.5',
        levelsUsed: 2,
        quoteAmount: '203',
        sessionKey: 'BTC:1',
      },
      ok: true,
    });
  });

  it('uses bids for Sell', () => {
    const result = estimatePerpsProMarketFill({
      amount: '2',
      amountUnit: 'base',
      book: snapshot,
      coin: 'BTC',
      sessionKey: 'BTC:1',
      side: 'sell',
      status: 'ready',
      szDecimals: 2,
    });
    expect(result).toMatchObject({
      estimate: { expectedEntryPrice: '98.5', quoteAmount: '197' },
      ok: true,
    });
  });

  it('converts quote to rounded-down base and recomputes VWAP', () => {
    const result = estimatePerpsProMarketFill({
      amount: '151.5',
      amountUnit: 'quote',
      book: snapshot,
      coin: 'BTC',
      sessionKey: 'BTC:1',
      side: 'buy',
      status: 'ready',
      szDecimals: 2,
    });
    expect(result).toMatchObject({
      estimate: {
        baseSize: '1.49',
        expectedEntryPrice: '101.32885906040268456376',
        quoteAmount: '150.98',
      },
      ok: true,
    });
  });

  it('fails closed when returned depth cannot cover the order', () => {
    expect(
      estimatePerpsProMarketFill({
        amount: '4',
        amountUnit: 'base',
        book: snapshot,
        coin: 'BTC',
        sessionKey: 'BTC:1',
        side: 'buy',
        status: 'ready',
        szDecimals: 2,
      }),
    ).toEqual({ error: 'insufficientDepth', ok: false });
  });

  it.each([
    ['stale', 'bookStale'],
    ['loading', 'bookUnavailable'],
  ] as const)('rejects %s snapshots', (status, error) => {
    expect(
      estimatePerpsProMarketFill({
        amount: '1',
        amountUnit: 'base',
        book: snapshot,
        coin: 'BTC',
        sessionKey: status === 'stale' ? null : 'BTC:1',
        side: 'buy',
        status,
        szDecimals: 2,
      }),
    ).toEqual({ error, ok: false });
  });

  it('rejects invalid levels before using a fallback price', () => {
    expect(
      estimatePerpsProMarketFill({
        amount: '1',
        amountUnit: 'base',
        book: book([], [level('101', '0')]),
        coin: 'BTC',
        sessionKey: 'BTC:1',
        side: 'buy',
        status: 'ready',
        szDecimals: 2,
      }),
    ).toEqual({ error: 'invalidLevel', ok: false });
  });
});
