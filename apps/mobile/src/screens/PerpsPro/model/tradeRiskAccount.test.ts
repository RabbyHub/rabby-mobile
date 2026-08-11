import {
  getPerpsProCollateralToken,
  resolvePerpsProCrossMarginAvailableAfterMaintenance,
} from './tradeRiskAccount';

const resolve = (
  overrides: Partial<
    Parameters<typeof resolvePerpsProCrossMarginAvailableAfterMaintenance>[0]
  > = {},
) =>
  resolvePerpsProCrossMarginAvailableAfterMaintenance({
    accountFactsReady: true,
    dexCrossAccountValue: '1.096224',
    dexCrossMaintenanceMarginUsed: '0.217363',
    unifiedAvailableAfterMaintenance: '35.08059422',
    userAbstraction: 'unifiedAccount',
    ...overrides,
  });

describe('Perps Pro Cross risk account facts', () => {
  it.each([
    ['USDC', 0],
    ['USDE', 235],
    ['USDT', 268],
    ['USDH', 360],
  ] as const)('maps %s to collateral token %s', (quote, token) => {
    expect(getPerpsProCollateralToken(quote)).toBe(token);
  });

  it('uses the server-computed collateral-token balance for Unified', () => {
    expect(resolve()).toBe('35.08059422');
  });

  it('uses only the selected DEX Cross facts for Standard', () => {
    expect(
      resolve({
        dexCrossAccountValue: '12.5',
        dexCrossMaintenanceMarginUsed: '0.75',
        userAbstraction: 'default',
      }),
    ).toBe('11.75');
  });

  it('fails closed for Portfolio Margin and unavailable account facts', () => {
    expect(resolve({ userAbstraction: 'portfolioMargin' })).toBeNull();
    expect(resolve({ accountFactsReady: false })).toBeNull();
    expect(resolve({ unifiedAvailableAfterMaintenance: null })).toBeNull();
    expect(
      resolve({
        dexCrossAccountValue: null,
        userAbstraction: 'default',
      }),
    ).toBeNull();
  });
});
