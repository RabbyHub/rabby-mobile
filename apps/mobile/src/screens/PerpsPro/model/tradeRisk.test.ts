import { resolvePerpsProProjectedTradeRisk } from './tradeRisk';

const calculateLiquidationPrice = jest.fn(() => 70);
const resolve = (
  overrides: Partial<
    Parameters<typeof resolvePerpsProProjectedTradeRisk>[0]
  > = {},
) =>
  resolvePerpsProProjectedTradeRisk({
    baseSize: '2',
    calculateLiquidationPrice,
    crossMarginAccountValue: '1000',
    crossMaintenanceMarginUsed: '10',
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
    expect(resolve({ crossMarginAccountValue: '0', marginMode: 'cross' })).toBe(
      null,
    );
  });
});
