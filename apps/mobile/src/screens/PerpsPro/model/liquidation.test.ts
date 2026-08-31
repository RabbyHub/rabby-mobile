import { projectPerpsProLiquidationPrice } from './liquidation';

const tiers = [
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
];

describe('Perps Pro tiered liquidation projection', () => {
  it('finds self-consistent long and short candidates', () => {
    const long = projectPerpsProLiquidationPrice({
      direction: 'long',
      margin: '20',
      positionSize: '1',
      referencePrice: '100',
      tiers,
    });
    const short = projectPerpsProLiquidationPrice({
      direction: 'short',
      margin: '20',
      positionSize: '1',
      referencePrice: '100',
      tiers,
    });

    expect(Number(long)).toBeLessThan(100);
    expect(Number(short)).toBeGreaterThan(100);
  });

  it('uses the maintenance deduction when liquidation crosses a tier', () => {
    const price = projectPerpsProLiquidationPrice({
      direction: 'short',
      margin: '200',
      positionSize: '10',
      referencePrice: '100',
      tiers,
    });

    expect(price).not.toBeNull();
    expect(Number(price) * 10).toBeGreaterThanOrEqual(1000);
  });

  it('fails closed for malformed tiers', () => {
    expect(
      projectPerpsProLiquidationPrice({
        direction: 'long',
        margin: '20',
        positionSize: '1',
        referencePrice: '100',
        tiers: [{ ...tiers[0], lowerBound: '1000' }],
      }),
    ).toBeNull();
  });
});
