import {
  resolvePerpsProCloseMarketSourceTag,
  resolvePerpsProCloseSize,
} from './positionAction';

describe('Perps Pro close amount', () => {
  it('rounds a slider-derived base size down to market precision', () => {
    expect(
      resolvePerpsProCloseSize({
        amountUnit: 'quote',
        inputSource: 'slider',
        manualAmount: '',
        percent: 50,
        positionSize: '1.2345',
        referencePrice: '100',
        szDecimals: 3,
      }),
    ).toBe('0.617');
  });

  it('converts a manual quote amount and keeps it independent of percent', () => {
    expect(
      resolvePerpsProCloseSize({
        amountUnit: 'quote',
        inputSource: 'manual',
        manualAmount: '25',
        percent: 100,
        positionSize: '1',
        referencePrice: '100',
        szDecimals: 4,
      }),
    ).toBe('0.25');
  });

  it('rejects manual amounts above the current position', () => {
    expect(
      resolvePerpsProCloseSize({
        amountUnit: 'base',
        inputSource: 'manual',
        manualAmount: '1.1',
        percent: 100,
        positionSize: '1',
        referencePrice: '100',
        szDecimals: 4,
      }),
    ).toBeNull();
  });
});

describe('Perps Pro close market source tag', () => {
  it('normalizes real market sources and omits missing values', () => {
    expect(resolvePerpsProCloseMarketSourceTag(' xyz ')).toBe('XYZ');
    expect(resolvePerpsProCloseMarketSourceTag('')).toBeNull();
    expect(resolvePerpsProCloseMarketSourceTag('   ')).toBeNull();
    expect(resolvePerpsProCloseMarketSourceTag(null)).toBeNull();
  });
});
