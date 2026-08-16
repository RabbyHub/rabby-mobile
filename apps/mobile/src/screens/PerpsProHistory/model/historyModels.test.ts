import type {
  SpotMeta,
  UserHistoricalOrders,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';

import { HYPE_EVM_BRIDGE_ADDRESS_MAP } from '@/constant/perps';

import {
  getPerpsProFundingHistoryKey,
  mapPerpsProFundingHistoryFact,
} from './fundingHistory';
import { mergePerpsProHistoryRows } from './historyModel';
import {
  getPerpsProOrderHistoryKey,
  mapPerpsProOrderHistoryFact,
} from './orderHistory';
import { buildPerpsProOrderExecutionIndex } from './orderExecution';
import { mapPerpsProTradeHistoryFact } from './tradeHistory';
import {
  mapPerpsProTransactionHistoryFact,
  summarizePerpsProTransactionHistoryFacts,
} from './transactionHistory';
import type { PerpsProLedgerFact } from '../types';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const spotMeta: SpotMeta = {
  tokens: [
    { index: 0, name: 'USDC' },
    { index: 1, name: 'HYPE' },
    { index: 235, name: 'USDE' },
    { index: 268, name: 'USDT0' },
  ],
  universe: [
    { index: 107, name: 'HYPE/USDC', tokens: [1, 0] },
    { index: 150, name: 'USDE/USDC', tokens: [235, 0] },
    { index: 166, name: 'USDT0/USDC', tokens: [268, 0] },
  ],
};

const makeOrder = (
  overrides: Partial<UserHistoricalOrders> = {},
): UserHistoricalOrders => ({
  order: {
    children: [],
    cloid: null,
    coin: 'BTC',
    isPositionTpsl: false,
    isTrigger: false,
    limitPx: '50000',
    oid: 7,
    orderType: 'Limit',
    origSz: '2',
    reduceOnly: false,
    side: 'B',
    sz: '0.5',
    tif: 'Gtc',
    timestamp: 90,
    triggerCondition: '',
    triggerPx: '0',
  },
  status: 'filled',
  statusTimestamp: 100,
  ...overrides,
});

const makeFill = (overrides: Partial<WsFill> = {}): WsFill => ({
  closedPnl: '12.5',
  coin: 'ETH',
  crossed: true,
  dir: 'Close Long',
  fee: '0.5',
  hash: '0xfill',
  oid: 8,
  px: '2000',
  side: 'A',
  startPosition: '1',
  sz: '0.25',
  tid: 9,
  time: 200,
  ...overrides,
});

const makeLedger = (
  delta: PerpsProLedgerFact['delta'],
  overrides: Partial<PerpsProLedgerFact> = {},
): PerpsProLedgerFact => ({
  delta,
  hash: '0xledger',
  time: 300,
  ...overrides,
});

describe('Perps Pro history models', () => {
  it('preserves order lifecycle events and displays Limit amounts in quote', () => {
    const filled = makeOrder();
    const canceled = makeOrder({
      status: 'canceled',
      statusTimestamp: 101,
    });
    expect(getPerpsProOrderHistoryKey(filled)).not.toBe(
      getPerpsProOrderHistoryKey(canceled),
    );
    expect(mapPerpsProOrderHistoryFact(filled, {})).toMatchObject({
      amountBase: '2',
      amountQuote: '100000',
      executionPrice: null,
      filledBase: '1.5',
      filledQuote: '75000',
      side: 'buy',
    });
  });

  it.each(['Market', 'Take Profit Market', 'Stop Market'])(
    'displays %s Amount and Filled in exact base size without treating protection prices as execution prices',
    orderType => {
      expect(
        mapPerpsProOrderHistoryFact(
          makeOrder({
            order: {
              ...makeOrder().order,
              limitPx: '51000',
              orderType,
              triggerPx: '49000',
            },
          }),
          {},
        ),
      ).toMatchObject({
        amountBase: '2',
        amountQuote: null,
        executionPrice: null,
        filledBase: '1.5',
        filledQuote: null,
        market: {
          displayBase: 'BTC',
        },
        price: null,
        priceKind: 'market',
      });
    },
  );

  it('keeps invalid or missing order sizes unavailable instead of fabricating zero', () => {
    expect(
      mapPerpsProOrderHistoryFact(
        makeOrder({
          order: {
            ...makeOrder().order,
            origSz: '',
            orderType: 'Market',
            sz: 'invalid',
          },
        }),
        {},
      ),
    ).toMatchObject({
      amountBase: null,
      amountQuote: null,
      executionPrice: null,
      filledBase: null,
      filledQuote: null,
      remainingBase: null,
    });
  });

  it('only exposes an order VWAP when fills fully cover the lifecycle row', () => {
    const completeIndex = buildPerpsProOrderExecutionIndex([
      makeFill({ coin: 'BTC', oid: 7, px: '49000', sz: '0.5', time: 95 }),
      makeFill({ coin: 'BTC', oid: 7, px: '51000', sz: '1', time: 99 }),
      makeFill({ coin: 'BTC', oid: 7, px: '100000', sz: '1', time: 101 }),
    ]);
    expect(
      mapPerpsProOrderHistoryFact(makeOrder(), {}, completeIndex),
    ).toMatchObject({
      executionPrice: '50333.33333333333333333333',
      filledBase: '1.5',
    });

    const incompleteIndex = buildPerpsProOrderExecutionIndex([
      makeFill({ coin: 'BTC', oid: 7, px: '49000', sz: '0.5', time: 95 }),
    ]);
    expect(
      mapPerpsProOrderHistoryFact(makeOrder(), {}, incompleteIndex),
    ).toMatchObject({ executionPrice: null });
  });

  it('calculates quote fill and net realized PNL without losing fee rebates', () => {
    expect(
      mapPerpsProTradeHistoryFact(
        makeFill({
          fee: '-0.25',
          feeToken: 'USDC',
          liquidation: {
            liquidatedUser: ACCOUNT,
            markPx: '2000',
            method: 'market',
          },
        }),
        {},
      ),
    ).toMatchObject({
      fee: '-0.25',
      feeToken: 'USDC',
      filledQuote: '500',
      isLiquidation: true,
      market: { sourceTag: null },
      netRealizedPnl: '12.75',
      side: 'sell',
    });
    const buy = mapPerpsProTradeHistoryFact(
      makeFill({ side: 'B', time: 200, tid: 9 }),
      {},
    );
    const sell = mapPerpsProTradeHistoryFact(
      makeFill({ side: 'A', time: 200, tid: 9 }),
      {},
    );
    expect(buy.key).not.toBe(sell.key);
  });

  it('keeps a canonical HIP-3 source without market metadata', () => {
    expect(
      mapPerpsProTradeHistoryFact(makeFill({ coin: 'xyz:AAPL' }), {}),
    ).toMatchObject({
      market: {
        displayBase: 'AAPL',
        displayPair: 'AAPLUSDC',
        sourceTag: 'xyz',
      },
    });
  });

  it('resolves @index markets from SpotMeta and canonicalizes settlement names', () => {
    expect(
      mapPerpsProTradeHistoryFact(makeFill({ coin: '@150' }), {}, spotMeta),
    ).toMatchObject({
      market: {
        displayBase: 'USDE',
        displayPair: 'USDEUSDC',
        quoteAsset: 'USDC',
        sourceTag: null,
      },
    });
    expect(
      mapPerpsProTradeHistoryFact(makeFill({ coin: '@166' }), {}, spotMeta),
    ).toMatchObject({
      market: { displayBase: 'USDT', displayPair: 'USDTUSDC' },
    });
    expect(
      mapPerpsProTradeHistoryFact(makeFill({ coin: '@107' }), {}, spotMeta),
    ).toMatchObject({
      market: { displayBase: 'HYPE', displayPair: 'HYPEUSDC' },
    });
  });

  it('uses the existing settlement index fallback when SpotMeta is unavailable', () => {
    expect(
      mapPerpsProTradeHistoryFact(makeFill({ coin: '@150' }), {}),
    ).toMatchObject({
      market: { displayBase: 'USDE', displayPair: 'USDEUSDC' },
    });
    expect(
      mapPerpsProTradeHistoryFact(makeFill({ coin: '@999' }), {}),
    ).toMatchObject({
      market: { displayBase: '@999', displayPair: '@999' },
    });
  });

  it('maps only transaction facts whose Perps direction is provable', () => {
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({ type: 'deposit', usdc: '-12.5' }),
        ACCOUNT,
      ).row,
    ).toMatchObject({
      amount: '12.5',
      assetAmountSource: 'legacyUsdc',
      direction: 'deposit',
    });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({ amount: '3', token: 'USDT', type: 'deposit' }),
        ACCOUNT,
      ).row,
    ).toMatchObject({
      amount: '3',
      asset: 'USDT',
      assetAmountSource: 'explicit',
      direction: 'deposit',
    });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          nonce: 1786805795351000,
          type: 'withdraw',
          usdc: '5',
        }),
        ACCOUNT,
      ).row,
    ).toMatchObject({
      direction: 'withdraw',
      settlementNonce: 1786805795351,
    });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({ type: 'accountClassTransfer', toPerp: false, usdc: '5' }),
        ACCOUNT,
      ).row,
    ).toMatchObject({ direction: 'withdraw' });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          destination: ACCOUNT,
          type: 'internalTransfer',
          usdc: '4',
          user: OTHER,
        }),
        ACCOUNT,
      ).row,
    ).toMatchObject({ direction: 'deposit' });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          destination: OTHER,
          type: 'send',
          usdcValue: '3',
          user: ACCOUNT,
        }),
        ACCOUNT,
      ).row,
    ).toMatchObject({ direction: 'withdraw' });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          destination: OTHER,
          sourceDex: 'spot',
          type: 'send',
          usdcValue: '3',
          user: ACCOUNT,
        }),
        ACCOUNT,
      ),
    ).toEqual({ exclusionReason: 'spotOnly', row: null });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          amount: '4.942581',
          destination: HYPE_EVM_BRIDGE_ADDRESS_MAP.USDE,
          destinationDex: 'spot',
          nonce: 1786604975615,
          sourceDex: 'spot',
          token: 'USDE',
          type: 'send',
          usdcValue: '4.941592',
          user: ACCOUNT,
        }),
        ACCOUNT,
      ).row,
    ).toMatchObject({
      amount: '4.942581',
      asset: 'USDE',
      direction: 'withdraw',
      settlementNonce: 1786604975615,
    });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          destination: ACCOUNT,
          destinationDex: '',
          sourceDex: 'spot',
          type: 'send',
          usdcValue: '2.5',
          user: ACCOUNT,
        }),
        ACCOUNT,
      ).row,
    ).toMatchObject({ amount: '2.5', direction: 'deposit' });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          destination: ACCOUNT,
          destinationDex: 'spot',
          sourceDex: '',
          type: 'send',
          usdcValue: '1.5',
          user: ACCOUNT,
        }),
        ACCOUNT,
      ).row,
    ).toMatchObject({ amount: '1.5', direction: 'withdraw' });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({
          destination: ACCOUNT,
          destinationDex: '',
          sourceDex: '',
          type: 'send',
          usdcValue: '1',
          user: ACCOUNT,
        }),
        ACCOUNT,
      ),
    ).toEqual({ exclusionReason: 'ambiguousDirection', row: null });
    expect(
      mapPerpsProTransactionHistoryFact(
        makeLedger({ amount: '1', token: 'HYPE', type: 'spotTransfer' }),
        ACCOUNT,
      ),
    ).toEqual({ exclusionReason: 'spotOnly', row: null });
    expect(
      summarizePerpsProTransactionHistoryFacts(
        [
          makeLedger({ type: 'deposit', usdc: '1' }),
          makeLedger({ type: 'unknownProtocolEvent' }),
        ],
        ACCOUNT,
      ),
    ).toEqual({
      excludedByReason: {
        ambiguousDirection: 0,
        excludedType: 1,
        invalidAmount: 0,
        spotOnly: 0,
      },
      visible: 1,
    });
  });

  it('keeps position side independent from signed funding cashflow', () => {
    expect(
      mapPerpsProFundingHistoryFact(
        {
          coin: 'BTC',
          fundingRate: '0.0001',
          szi: '1',
          time: 400,
          usdc: '2.5',
        },
        {},
      ),
    ).toMatchObject({ amount: '2.5', positionSide: 'long' });
    expect(
      mapPerpsProFundingHistoryFact(
        {
          coin: 'BTC',
          fundingRate: '-0.0001',
          szi: '-1',
          time: 401,
          usdc: '2.5',
        },
        {},
      ),
    ).toMatchObject({ amount: '2.5', positionSide: 'short' });
  });

  it('treats protocol null funding hashes as composite identities', () => {
    const base = {
      coin: 'BTC',
      fundingRate: '0.0001000',
      hash: `0x${'0'.repeat(64)}`,
      szi: '1.00',
      time: 400,
      usdc: '2.500',
    };
    expect(getPerpsProFundingHistoryKey(base)).toBe(
      'funding:400:BTC:1:2.5:0.0001',
    );
    expect(getPerpsProFundingHistoryKey({ ...base, coin: 'ETH' })).not.toBe(
      getPerpsProFundingHistoryKey(base),
    );
    expect(getPerpsProFundingHistoryKey({ ...base, hash: '0xABC123' })).toBe(
      'hash:0xabc123',
    );
  });

  it('merges by stable key, keeps incoming updates and caps newest first', () => {
    const old = mapPerpsProTradeHistoryFact(makeFill({ time: 1, tid: 1 }), {});
    const replaced = { ...old, fee: '2' };
    const newer = mapPerpsProTradeHistoryFact(
      makeFill({ time: 2, tid: 2 }),
      {},
    );
    expect(mergePerpsProHistoryRows([replaced, newer], [old], 1)).toEqual([
      newer,
    ]);
    expect(mergePerpsProHistoryRows([replaced], [old], 2)[0]?.fee).toBe('2');
  });
});
