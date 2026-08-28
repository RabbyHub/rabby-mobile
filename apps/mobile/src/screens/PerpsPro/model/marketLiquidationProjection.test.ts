import type { AssetPosition, L2Book } from '@rabby-wallet/hyperliquid-sdk';

import {
  resolvePerpsProMarketClearingPrice,
  resolvePerpsProMarketLiquidationOutcome,
} from './marketLiquidationProjection';

const btcTiers = [
  {
    lowerBound: '0',
    maintenanceDeduction: '0',
    maintenanceMarginRate: '0.0125',
    maxLeverage: 40,
  },
  {
    lowerBound: '150000000',
    maintenanceDeduction: '1875000',
    maintenanceMarginRate: '0.025',
    maxLeverage: 20,
  },
];

const createBook = ({
  asks = [
    { n: 1, px: '78610', sz: '10' },
    { n: 1, px: '78620', sz: '10' },
    { n: 1, px: '78640', sz: '10' },
  ],
  bids = [
    { n: 1, px: '78603', sz: '10' },
    { n: 1, px: '78590', sz: '10' },
    { n: 1, px: '78570', sz: '10' },
  ],
}: Partial<{
  asks: L2Book['levels'][number];
  bids: L2Book['levels'][number];
}> = {}): L2Book => ({
  coin: 'BTC',
  levels: [bids, asks],
  time: 1,
});

const currentLong = (
  overrides: Partial<AssetPosition['position']> = {},
): AssetPosition['position'] => ({
  coin: 'BTC',
  cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
  entryPx: '78827',
  leverage: { rawUsd: '-10.517885', type: 'isolated', value: 9 },
  marginUsed: '1.279765',
  maxLeverage: 40,
  positionValue: '11.791275',
  returnOnEquity: '0',
  szi: '0.00015',
  unrealizedPnl: '0',
  ...overrides,
});

const resolve = (
  overrides: Partial<
    Parameters<typeof resolvePerpsProMarketLiquidationOutcome>[0]
  > = {},
) =>
  resolvePerpsProMarketLiquidationOutcome({
    baseSize: '30',
    book: createBook(),
    coin: 'BTC',
    crossMarginAvailableAfterMaintenance: '13.18',
    currentPosition: null,
    leverage: 9,
    maintenanceMarginTiers: btcTiers,
    marginMode: 'isolated',
    markPrice: '78606.5',
    midPrice: '78606.5',
    pxDecimals: 0,
    sessionKey: 'BTC:1',
    side: 'buy',
    status: 'ready',
    szDecimals: 5,
    ...overrides,
  });

describe('Perps Pro Market liquidation projection', () => {
  it('uses the last consumed ask instead of VWAP when depth is complete', () => {
    const clearing = resolvePerpsProMarketClearingPrice({
      baseSize: '30',
      book: createBook(),
      coin: 'BTC',
      midPrice: '78606.5',
      sessionKey: 'BTC:1',
      side: 'buy',
      status: 'ready',
      szDecimals: 5,
    });
    expect(
      'error' in clearing ? clearing : clearing.clearingPrice.toFixed(),
    ).toBe('78640');
    expect('error' in clearing ? null : clearing.source).toBe('bookMarginal');
    const outcome = resolve();
    expect(outcome).toMatchObject({
      kind: 'price',
      risk: {
        clearingPrice: '78640',
        clearingSource: 'bookMarginal',
        projectedSize: '30',
      },
    });
  });

  it('reproduces the official 300 BTC Isolated Buy screenshot', () => {
    const outcome = resolve({
      baseSize: '300',
      currentPosition: currentLong(),
    });

    expect(outcome).toMatchObject({
      kind: 'price',
      risk: {
        clearingPrice: '84895',
        clearingSource: 'slippageCap',
        effectiveLeverage: '9',
        initialMarginTierLowerBound: '0',
        liquidationPrice: '70129',
        liquidationTierLowerBound: '0',
        liquidationTierUpperBound: '150000000',
        maintenance: '318356.409178125',
        maintenanceDeduction: '0',
        maintenanceMarginRate: '0.0125',
        projectedSize: '300.00015',
        riskMargin: '2829834.74825',
        riskNotional: '25468512.73425',
      },
    });
    expect(Object.isFrozen(outcome)).toBe(true);
    expect(outcome.kind === 'price' && Object.isFrozen(outcome.risk)).toBe(
      true,
    );
  });

  it('uses the protected Sell cap when bid depth is insufficient', () => {
    expect(
      resolve({
        baseSize: '300',
        currentPosition: null,
        side: 'sell',
      }),
    ).toMatchObject({
      kind: 'price',
      risk: {
        clearingPrice: '72317',
        clearingSource: 'slippageCap',
        projectedSize: '300',
      },
    });
  });

  it('fails closed when an existing Isolated position has no rawUsd', () => {
    expect(
      resolve({
        currentPosition: currentLong({
          leverage: { type: 'isolated', value: 9 },
        }),
      }),
    ).toEqual({ kind: 'unavailable', reason: 'isolatedRawUsd' });
  });

  it('projects partial reduction and direction flips from rawUsd', () => {
    expect(
      resolve({
        baseSize: '0.00005',
        currentPosition: currentLong(),
        side: 'sell',
      }),
    ).toMatchObject({ kind: 'price', risk: { projectedSize: '0.0001' } });
    expect(
      resolve({
        baseSize: '0.00015',
        currentPosition: currentLong(),
        side: 'sell',
      }),
    ).toEqual({ kind: 'notApplicable', reason: 'flat' });
    expect(
      resolve({
        baseSize: '0.0002',
        currentPosition: currentLong(),
        side: 'sell',
      }),
    ).toMatchObject({ kind: 'price', risk: { projectedSize: '0.00005' } });
  });

  it('restores current target maintenance for Cross before applying top-up', () => {
    const outcome = resolve({
      crossMarginAvailableAfterMaintenance: '23.59',
      currentPosition: currentLong({
        leverage: { type: 'cross', value: 9 },
      }),
      marginMode: 'cross',
    });
    expect(outcome).toMatchObject({
      kind: 'price',
      risk: { clearingPrice: '78640', projectedSize: '30.00015' },
    });
  });

  it('solves against the candidate notional tier and applies its deduction', () => {
    expect(
      resolve({
        baseSize: '10',
        book: createBook({ bids: [{ n: 1, px: '100', sz: '20' }] }),
        leverage: 10,
        maintenanceMarginTiers: [
          {
            lowerBound: '0',
            maintenanceDeduction: '0',
            maintenanceMarginRate: '0.05',
            maxLeverage: 10,
          },
          {
            lowerBound: '1000',
            maintenanceDeduction: '50',
            maintenanceMarginRate: '0.1',
            maxLeverage: 5,
          },
        ],
        markPrice: '100',
        midPrice: '100',
        pxDecimals: 2,
        side: 'sell',
      }),
    ).toMatchObject({
      kind: 'price',
      risk: {
        clearingPrice: '100',
        initialMarginTierLowerBound: '1000',
        liquidationPrice: '113.64',
        liquidationTierLowerBound: '1000',
        maintenance: '50',
        maintenanceDeduction: '50',
        riskMargin: '200',
        riskNotional: '1000',
      },
    });
  });

  it('distinguishes a non-positive liquidation result from unavailable data', () => {
    expect(
      resolve({
        baseSize: '1',
        book: createBook({ asks: [{ n: 1, px: '101', sz: '2' }] }),
        crossMarginAvailableAfterMaintenance: '1000',
        marginMode: 'cross',
        markPrice: '100',
        midPrice: '100',
      }),
    ).toEqual({ kind: 'noPositivePrice' });
  });

  it('fails closed for stale/wrong books and malformed tiers', () => {
    expect(resolve({ status: 'stale' })).toEqual({
      kind: 'unavailable',
      reason: 'book',
    });
    expect(resolve({ book: { ...createBook(), coin: 'ETH' } })).toEqual({
      kind: 'unavailable',
      reason: 'bookIdentity',
    });
    expect(resolve({ maintenanceMarginTiers: [] })).toEqual({
      kind: 'unavailable',
      reason: 'tiers',
    });
    expect(
      resolve({
        maintenanceMarginTiers: [
          btcTiers[0],
          { ...btcTiers[1], maintenanceDeduction: '1' },
        ],
      }),
    ).toEqual({ kind: 'unavailable', reason: 'tiers' });
  });
});
