import {
  resolvePerpsProProjectedTradeRisk,
  resolvePerpsProProjectedTradeRiskOutcome,
} from './tradeRisk';

const calculateProtocolLiquidationPrice = (
  price: number,
  margin: number,
  direction: 'Long' | 'Short',
  positionSize: number,
  notional: number,
  maxLeverage: number,
) => {
  const maintenanceMarginRate = 1 / maxLeverage / 2;
  const side = direction === 'Long' ? 1 : -1;
  const marginAvailable = margin - notional * maintenanceMarginRate;
  if (marginAvailable <= 0) {
    return 0;
  }
  return Math.max(
    price -
      (side * marginAvailable) /
        positionSize /
        (1 - maintenanceMarginRate * side),
    0,
  );
};

const calculateLiquidationPrice = jest.fn(() => 70);
const resolve = (
  overrides: Partial<
    Parameters<typeof resolvePerpsProProjectedTradeRisk>[0]
  > = {},
) =>
  resolvePerpsProProjectedTradeRisk({
    baseSize: '2',
    calculateLiquidationPrice,
    crossMarginAvailableAfterMaintenance: '990',
    currentPosition: null,
    entryPrice: '100',
    leverage: 10,
    marginMode: 'isolated',
    markPrice: '100',
    maxLeverage: 20,
    pxDecimals: 2,
    side: 'buy',
    ...overrides,
  });

describe('resolvePerpsProProjectedTradeRisk', () => {
  beforeEach(() => calculateLiquidationPrice.mockClear());

  it('calculates a new isolated position from the frozen expected entry', () => {
    expect(resolve()).toEqual({
      gap: -0.3,
      liquidationPrice: '70.00',
      projectedEntryPrice: '100',
      projectedSize: '2',
    });
    expect(calculateLiquidationPrice).toHaveBeenCalledWith(
      100,
      20,
      'Long',
      2,
      200,
      20,
    );
  });

  it('uses a weighted entry and existing isolated margin for same-side growth', () => {
    resolve({
      currentPosition: {
        entryPx: '80',
        marginUsed: '8',
        szi: '1',
      },
    });
    expect(calculateLiquidationPrice).toHaveBeenCalledWith(
      280 / 3,
      28,
      'Long',
      3,
      280,
      20,
    );
  });

  it('uses cross account risk facts in cross mode', () => {
    resolve({ marginMode: 'cross' });
    expect(calculateLiquidationPrice).toHaveBeenCalledWith(
      100,
      990,
      'Long',
      2,
      200,
      20,
    );
  });

  it('matches the large BTC web estimator by projecting display-only initial margin', () => {
    const maintenanceMarginTiers = [
      {
        lowerBound: '0',
        maintenanceDeduction: '0',
        maintenanceMarginRate: '0.0125',
        maxLeverage: 40,
      },
    ];

    const long = resolve({
      baseSize: '20',
      crossMarginAvailableAfterMaintenance: '23.59',
      entryPrice: '78930.5',
      leverage: 17,
      maintenanceMarginTiers,
      marginMode: 'cross',
      markPrice: '78930.5',
      maxLeverage: 40,
      pxDecimals: 0,
      side: 'buy',
    });
    const short = resolve({
      baseSize: '20',
      crossMarginAvailableAfterMaintenance: '27.10',
      entryPrice: '78894.5',
      leverage: 17,
      maintenanceMarginTiers,
      marginMode: 'cross',
      markPrice: '78894.5',
      maxLeverage: 40,
      pxDecimals: 0,
      side: 'sell',
    });

    expect(long).toMatchObject({
      liquidationPrice: '75228',
      projectedSize: '20',
    });
    expect(short).toMatchObject({
      liquidationPrice: '82504',
      projectedSize: '20',
    });
    expect(calculateLiquidationPrice).not.toHaveBeenCalled();
  });

  it('replaces current target maintenance when projecting cross-position growth', () => {
    resolve({
      currentPosition: {
        entryPx: '80',
        positionValue: '-100',
        szi: '-1',
      },
      marginMode: 'cross',
      side: 'sell',
    });
    expect(calculateLiquidationPrice).toHaveBeenCalledWith(
      280 / 3,
      992.5,
      'Short',
      3,
      280,
      20,
    );
  });

  it('falls back to Mark notional when current position value is unavailable', () => {
    resolve({
      currentPosition: {
        entryPx: '80',
        szi: '-1',
      },
      marginMode: 'cross',
      side: 'sell',
    });
    expect(calculateLiquidationPrice).toHaveBeenCalledWith(
      280 / 3,
      992.5,
      'Short',
      3,
      280,
      20,
    );
  });

  it('reproduces the corrected BTC-USDE screenshot projection for both sides', () => {
    const facts = {
      calculateLiquidationPrice: calculateProtocolLiquidationPrice,
      crossMarginAvailableAfterMaintenance: '82.79',
      currentPosition: {
        entryPx: '64169',
        positionValue: '-184.59165',
        szi: '-0.00285',
      },
      entryPrice: '64769',
      leverage: 12,
      marginMode: 'cross' as const,
      markPrice: '64769',
      maxLeverage: 40,
      pxDecimals: 0,
    };

    expect(
      resolvePerpsProProjectedTradeRisk({
        ...facts,
        baseSize: '0.008',
        entryPrice: '64770',
        side: 'buy',
      }),
    ).toMatchObject({ liquidationPrice: '48857', projectedSize: '0.00515' });
    expect(
      resolvePerpsProProjectedTradeRisk({
        ...facts,
        baseSize: '0.00555',
        side: 'sell',
      }),
    ).toMatchObject({ liquidationPrice: '73774', projectedSize: '0.0084' });
  });

  it('reproduces the Unified NVDA 37% long and short liquidation prices', () => {
    const facts = {
      baseSize: '1.13',
      calculateLiquidationPrice: calculateProtocolLiquidationPrice,
      crossMarginAvailableAfterMaintenance: '35.08059422',
      currentPosition: null,
      entryPrice: '223.88',
      leverage: 20,
      marginMode: 'cross' as const,
      markPrice: '223.88',
      maxLeverage: 20,
      pxDecimals: 2,
    };
    expect(
      resolvePerpsProProjectedTradeRisk({ ...facts, side: 'buy' }),
    ).toMatchObject({ liquidationPrice: '197.78', projectedSize: '1.13' });
    expect(
      resolvePerpsProProjectedTradeRisk({ ...facts, side: 'sell' }),
    ).toMatchObject({ liquidationPrice: '248.71', projectedSize: '1.13' });
  });

  it('keeps the Unified NVDA 2% long without a positive price and the short finite', () => {
    const facts = {
      baseSize: '0.061',
      calculateLiquidationPrice: calculateProtocolLiquidationPrice,
      crossMarginAvailableAfterMaintenance: '35.08059422',
      currentPosition: null,
      entryPrice: '223.88',
      leverage: 20,
      marginMode: 'cross' as const,
      markPrice: '223.88',
      maxLeverage: 20,
      pxDecimals: 2,
    };
    expect(
      resolvePerpsProProjectedTradeRisk({ ...facts, side: 'buy' }),
    ).toBeNull();
    expect(
      resolvePerpsProProjectedTradeRisk({ ...facts, side: 'sell' }),
    ).toMatchObject({ liquidationPrice: '779.48', projectedSize: '0.061' });
  });

  it('distinguishes the MSFT no-positive Long from its finite Short price', () => {
    const facts = {
      baseSize: '0.023',
      calculateLiquidationPrice: calculateProtocolLiquidationPrice,
      crossMarginAvailableAfterMaintenance: '36.2449065',
      currentPosition: null,
      entryPrice: '509.21',
      leverage: 20,
      marginMode: 'cross' as const,
      markPrice: '509.21',
      maxLeverage: 20,
      pxDecimals: 2,
    };
    expect(
      resolvePerpsProProjectedTradeRiskOutcome({ ...facts, side: 'buy' }),
    ).toEqual({ kind: 'noPositivePrice' });
    expect(
      resolvePerpsProProjectedTradeRiskOutcome({ ...facts, side: 'sell' }),
    ).toMatchObject({
      kind: 'price',
      risk: { liquidationPrice: '2034.22', projectedSize: '0.023' },
    });
  });

  it('does not estimate liquidation when an opposite order only reduces', () => {
    expect(resolve({ currentPosition: { szi: '-3' } })).toBeNull();
    expect(calculateLiquidationPrice).not.toHaveBeenCalled();
  });

  it('keeps reduction and missing facts distinguishable internally', () => {
    expect(
      resolvePerpsProProjectedTradeRiskOutcome({
        baseSize: '2',
        calculateLiquidationPrice,
        crossMarginAvailableAfterMaintenance: '990',
        currentPosition: { szi: '-3' },
        entryPrice: '100',
        leverage: 10,
        marginMode: 'isolated',
        markPrice: '100',
        maxLeverage: 20,
        pxDecimals: 2,
        side: 'buy',
      }),
    ).toEqual({ kind: 'notApplicable', reason: 'reducesOrCloses' });
    expect(
      resolvePerpsProProjectedTradeRiskOutcome({
        baseSize: '2',
        calculateLiquidationPrice,
        crossMarginAvailableAfterMaintenance: null,
        currentPosition: null,
        entryPrice: '100',
        leverage: 10,
        marginMode: 'cross',
        markPrice: '100',
        maxLeverage: 20,
        pxDecimals: 2,
        side: 'buy',
      }),
    ).toEqual({ kind: 'unavailable', reason: 'margin' });
  });

  it('preserves projected-risk behavior when the order flips direction', () => {
    expect(resolve({ currentPosition: { szi: '-1' } })).toEqual({
      gap: -0.3,
      liquidationPrice: '70.00',
      projectedEntryPrice: '100',
      projectedSize: '1',
    });
    expect(calculateLiquidationPrice).toHaveBeenCalledWith(
      100,
      10,
      'Long',
      1,
      100,
      20,
    );
  });

  it('fails closed when required risk inputs are unavailable', () => {
    expect(
      resolve({
        crossMarginAvailableAfterMaintenance: null,
        marginMode: 'cross',
      }),
    ).toBe(null);
  });
});
