import { resolvePerpsProProjectedTradeRisk } from './tradeRisk';

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

  it('does not estimate liquidation when an opposite order only reduces', () => {
    expect(resolve({ currentPosition: { szi: '-3' } })).toBeNull();
    expect(calculateLiquidationPrice).not.toHaveBeenCalled();
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
