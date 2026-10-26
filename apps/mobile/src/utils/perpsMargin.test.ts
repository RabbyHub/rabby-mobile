import {
  buildPerpsMaintenanceMarginTiers,
  calculateIsolatedPositionMarginRatio,
  calculatePerpsMaintenanceMargin,
} from './perpsMargin';

describe('Perps maintenance margin', () => {
  it('builds a continuous tiered maintenance curve with deductions', () => {
    const tiers = buildPerpsMaintenanceMarginTiers([
      { lowerBound: '0', maxLeverage: 10 },
      { lowerBound: '3000000', maxLeverage: 5 },
    ]);

    expect(tiers).toEqual([
      {
        lowerBound: '0',
        maintenanceDeduction: '0',
        maintenanceMarginRate: '0.05',
        maxLeverage: 10,
      },
      {
        lowerBound: '3000000',
        maintenanceDeduction: '150000',
        maintenanceMarginRate: '0.1',
        maxLeverage: 5,
      },
    ]);
    expect(
      calculatePerpsMaintenanceMargin({
        positionNotional: '3000000',
        tiers,
      }),
    ).toBe('150000');
    expect(
      calculatePerpsMaintenanceMargin({
        positionNotional: '4000000',
        tiers,
      }),
    ).toBe('250000');
  });

  it('derives isolated risk from maintenance margin and isolated equity', () => {
    const tiers = buildPerpsMaintenanceMarginTiers([
      { lowerBound: '0', maxLeverage: 50 },
    ]);

    expect(
      calculateIsolatedPositionMarginRatio({
        isolatedEquity: '4.967826',
        positionNotional: '100.02765',
        tiers,
      }),
    ).toBe('0.20135095311309212521');
  });

  it('fails closed for invalid tables, notionals, or isolated equity', () => {
    expect(
      buildPerpsMaintenanceMarginTiers([{ lowerBound: '1', maxLeverage: 50 }]),
    ).toEqual([]);
    expect(
      buildPerpsMaintenanceMarginTiers([
        { lowerBound: '0', maxLeverage: 5 },
        { lowerBound: '10', maxLeverage: 10 },
      ]),
    ).toEqual([]);
    expect(
      calculateIsolatedPositionMarginRatio({
        isolatedEquity: '0',
        positionNotional: '100',
        tiers: buildPerpsMaintenanceMarginTiers([
          { lowerBound: '0', maxLeverage: 50 },
        ]),
      }),
    ).toBeNull();
  });
});
