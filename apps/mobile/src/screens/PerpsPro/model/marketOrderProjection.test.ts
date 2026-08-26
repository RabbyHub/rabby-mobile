import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';

import {
  resolvePerpsProMarketOrderProjection,
  resolvePerpsProMarketRiskEntryPrice,
} from './marketOrderProjection';

const book: L2Book = {
  coin: 'xyz:MSFT',
  levels: [
    [
      { n: 1, px: '509.10', sz: '0.01' },
      { n: 1, px: '509.00', sz: '0.02' },
    ],
    [
      { n: 1, px: '509.20', sz: '0.01' },
      { n: 1, px: '509.40', sz: '0.02' },
    ],
  ],
  time: 123,
};

describe('resolvePerpsProMarketOrderProjection', () => {
  it('uses asks for Buy VWAP while preserving Mid as the SDK anchor', () => {
    expect(
      resolvePerpsProMarketOrderProjection({
        baseSize: '0.023',
        book,
        coin: 'xyz:MSFT',
        midPrice: '509.15',
        sessionKey: 'xyz:MSFT:1',
        side: 'buy',
        status: 'ready',
        szDecimals: 3,
      }),
    ).toEqual({
      baseSize: '0.023',
      bookTime: 123,
      estimatedEntryPrice: '509.31304347826086956522',
      estimatedQuoteAmount: '11.7142',
      levelsUsed: 2,
      sessionKey: 'xyz:MSFT:1',
      slippageReferenceMidPrice: '509.15',
      source: 'fullL2',
    });
  });

  it('uses bids for Sell VWAP', () => {
    expect(
      resolvePerpsProMarketOrderProjection({
        baseSize: '0.023',
        book,
        coin: 'xyz:MSFT',
        midPrice: '509.15',
        sessionKey: 'xyz:MSFT:1',
        side: 'sell',
        status: 'ready',
        szDecimals: 3,
      }),
    ).toMatchObject({
      estimatedEntryPrice: '509.04347826086956521739',
      estimatedQuoteAmount: '11.708',
      slippageReferenceMidPrice: '509.15',
      source: 'fullL2',
    });
  });

  it('falls back to Mid quote semantics without inventing a risk entry', () => {
    expect(
      resolvePerpsProMarketOrderProjection({
        baseSize: '0.023',
        book: null,
        coin: 'xyz:MSFT',
        midPrice: '509.21',
        sessionKey: null,
        side: 'buy',
        status: 'loading',
        szDecimals: 3,
      }),
    ).toEqual({
      baseSize: '0.023',
      estimatedEntryPrice: null,
      estimatedQuoteAmount: '11.71183',
      fillError: 'bookUnavailable',
      slippageReferenceMidPrice: '509.21',
      source: 'midFallback',
    });
  });

  it('keeps insufficient depth explicit instead of treating Mid as VWAP', () => {
    expect(
      resolvePerpsProMarketOrderProjection({
        baseSize: '1',
        book,
        coin: 'xyz:MSFT',
        midPrice: '509.15',
        sessionKey: 'xyz:MSFT:1',
        side: 'buy',
        status: 'ready',
        szDecimals: 3,
      }),
    ).toMatchObject({
      estimatedEntryPrice: null,
      fillError: 'insufficientDepth',
      source: 'midFallback',
    });
  });

  it('uses full-L2 VWAP as the risk entry only when the whole order is fillable', () => {
    const projection = resolvePerpsProMarketOrderProjection({
      baseSize: '0.023',
      book,
      coin: 'xyz:MSFT',
      midPrice: '509.15',
      sessionKey: 'xyz:MSFT:1',
      side: 'buy',
      status: 'ready',
      szDecimals: 3,
    });

    expect(resolvePerpsProMarketRiskEntryPrice(projection)).toBe(
      '509.31304347826086956522',
    );
  });

  it.each(['20', '80', '100', '10000'])(
    'keeps a Mid risk entry for an unfillable %s-base order',
    baseSize => {
      const projection = resolvePerpsProMarketOrderProjection({
        baseSize,
        book,
        coin: 'xyz:MSFT',
        midPrice: '509.15',
        sessionKey: 'xyz:MSFT:1',
        side: 'buy',
        status: 'ready',
        szDecimals: 3,
      });

      expect(projection).toMatchObject({
        fillError: 'insufficientDepth',
        source: 'midFallback',
      });
      expect(resolvePerpsProMarketRiskEntryPrice(projection)).toBe('509.15');
    },
  );
});
