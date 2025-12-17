import { PERPS_POSITION_RISK_LEVEL } from '@/constant/perps';

/**
 * Calculate the distance to liquidation as a percentage
 * @param liquidationPrice - The liquidation price
 * @param markPrice - The current mark price
 * @returns The absolute distance to liquidation as a decimal (e.g., 0.05 for 5%)
 */
export const calculateDistanceToLiquidation = (
  liquidationPrice: number | string | undefined,
  markPrice: number | string | undefined,
): number => {
  const liqPx = Number(liquidationPrice || 0);
  const markPx = Number(markPrice || 0);
  if (markPx === 0) {
    return 0;
  }
  return Math.abs((liqPx - markPx) / markPx);
};

export const getRiskLevel = (
  distanceLiquidation: number,
): PERPS_POSITION_RISK_LEVEL => {
  if (distanceLiquidation <= 0.03) {
    return PERPS_POSITION_RISK_LEVEL.DANGER;
  } else if (distanceLiquidation > 0.03 && distanceLiquidation < 0.08) {
    return PERPS_POSITION_RISK_LEVEL.WARNING;
  } else {
    return PERPS_POSITION_RISK_LEVEL.SAFE;
  }
};
