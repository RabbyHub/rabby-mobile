import { valueToBigNumber } from '@aave/math-utils';
import { DisplayPoolReserveInfo } from '../type';

export const getSupplyCapData = (asset: DisplayPoolReserveInfo) => {
  let supplyCapUsage: number = asset
    ? valueToBigNumber(asset.reserve.totalLiquidity)
        .dividedBy(asset.reserve.supplyCap)
        .toNumber() * 100
    : 0;
  supplyCapUsage = supplyCapUsage === Infinity ? 0 : supplyCapUsage;
  const supplyCapReached = supplyCapUsage >= 99.99;
  return { supplyCapUsage, supplyCapReached };
};
