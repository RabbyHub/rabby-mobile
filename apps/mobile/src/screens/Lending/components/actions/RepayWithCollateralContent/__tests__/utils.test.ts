import {
  DEFAULT_REPAY_WITH_COLLATERAL_SLIPPAGE,
  isSupportRepayWithCollateral,
} from '../utils';

const enabledMarket = {
  enabledFeatures: {
    collateralRepay: true,
  },
  addresses: {
    REPAY_WITH_COLLATERAL_ADAPTER: '0x0000000000000000000000000000000000000001',
  },
} as any;

describe('RepayWithCollateralContent utils', () => {
  it('keeps the repay-with-collateral default slippage stable', () => {
    expect(DEFAULT_REPAY_WITH_COLLATERAL_SLIPPAGE).toBe(100);
  });

  it('returns true only for supported chains with enabled market adapter', () => {
    expect(isSupportRepayWithCollateral(1, enabledMarket)).toBe(true);
    expect(isSupportRepayWithCollateral(42161, enabledMarket)).toBe(true);
    expect(isSupportRepayWithCollateral(8453, enabledMarket)).toBe(false);
  });

  it('returns a boolean false when market feature flags or adapter addresses are missing', () => {
    expect(
      isSupportRepayWithCollateral(1, {
        ...enabledMarket,
        enabledFeatures: { collateralRepay: false },
      }),
    ).toBe(false);
    expect(
      isSupportRepayWithCollateral(1, {
        ...enabledMarket,
        addresses: { REPAY_WITH_COLLATERAL_ADAPTER: '' },
      }),
    ).toBe(false);
    expect(isSupportRepayWithCollateral(1)).toBe(false);
  });
});
