import { INTERNAL_REQUEST_ORIGIN } from '@/constant/internalRequest';
import BigNumber from 'bignumber.js';

export function getInternalGasLimit({
  origin,
  gas,
}: {
  origin?: string;
  gas?: string | number;
}) {
  if (origin !== INTERNAL_REQUEST_ORIGIN || gas == null) {
    return undefined;
  }

  const gasLimit = new BigNumber(gas);
  if (
    !gasLimit.isFinite() ||
    !gasLimit.isInteger() ||
    gasLimit.lte(0) ||
    gasLimit.gt(Number.MAX_SAFE_INTEGER)
  ) {
    return undefined;
  }

  return `0x${gasLimit.toString(16)}`;
}
