import { PERPS_POSITION_RISK_LEVEL } from '@/constant/perps';

import { calculateDistanceToLiquidation, getRiskLevel } from '../utils';

describe('PerpsPositionSection utils', () => {
  describe('calculateDistanceToLiquidation', () => {
    it('calculates absolute distance for liquidation prices below or above mark price', () => {
      expect(calculateDistanceToLiquidation(90, 100)).toBe(0.1);
      expect(calculateDistanceToLiquidation(110, 100)).toBe(0.1);
    });

    it('accepts numeric strings from position payloads', () => {
      expect(calculateDistanceToLiquidation('95000', '100000')).toBe(0.05);
    });

    it('returns zero when mark price is missing or zero', () => {
      expect(calculateDistanceToLiquidation(100, 0)).toBe(0);
      expect(calculateDistanceToLiquidation(100, undefined)).toBe(0);
    });
  });

  describe('getRiskLevel', () => {
    it('marks positions at or below 3% from liquidation as danger', () => {
      expect(getRiskLevel(0)).toBe(PERPS_POSITION_RISK_LEVEL.DANGER);
      expect(getRiskLevel(0.03)).toBe(PERPS_POSITION_RISK_LEVEL.DANGER);
    });

    it('marks positions between 3% and 8% from liquidation as warning', () => {
      expect(getRiskLevel(0.030001)).toBe(PERPS_POSITION_RISK_LEVEL.WARNING);
      expect(getRiskLevel(0.079999)).toBe(PERPS_POSITION_RISK_LEVEL.WARNING);
    });

    it('marks positions at or above 8% from liquidation as safe', () => {
      expect(getRiskLevel(0.08)).toBe(PERPS_POSITION_RISK_LEVEL.SAFE);
      expect(getRiskLevel(0.2)).toBe(PERPS_POSITION_RISK_LEVEL.SAFE);
    });
  });
});
