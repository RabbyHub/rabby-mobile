import { PERPS_BUILD_FEE } from '@/constant/perps';

// maxBuilderFee and the order fee share Hyperliquid's tenths-of-a-basis-point
// unit. A nonzero approval may still be too small for the current order fee.
export const isPerpsBuilderFeeApproved = (maxBuilderFee: unknown): boolean =>
  typeof maxBuilderFee === 'number' &&
  Number.isFinite(maxBuilderFee) &&
  maxBuilderFee >= PERPS_BUILD_FEE;
