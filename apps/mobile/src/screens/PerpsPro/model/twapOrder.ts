import BigNumber from 'bignumber.js';
import { resolvePerpsProMinimumOrderAmount } from './trade';

export const PERPS_PRO_TWAP_MIN_MINUTES = 5;
export const PERPS_PRO_TWAP_MAX_MINUTES = 1439;
export const PERPS_PRO_TWAP_MIN_NOTIONAL = 100;
export const PERPS_PRO_TWAP_DURATION_PRESETS = [30, 60, 360, 720] as const;

export type PerpsProTwapValidationError =
  | 'amountRequired'
  | 'amountTooSmall'
  | 'amountExceedsMaximum'
  | 'invalidPrecision'
  | 'priceUnavailable'
  | 'durationRequired'
  | 'durationInvalid'
  | 'durationTooShort'
  | 'durationTooLong';

/** Reject decimal/sign/exponent edits instead of silently changing their value. */
export const sanitizePerpsProTwapDuration = (
  value: string,
  previous: string,
): string => {
  if (!/^\d*$/.test(value)) return previous;
  if (!value) return '';
  return BigNumber.minimum(value, PERPS_PRO_TWAP_MAX_MINUTES).toFixed(0);
};

export const parsePerpsProTwapDuration = (
  draft: string,
):
  | { minutes: number; error: null }
  | { minutes: null; error: PerpsProTwapValidationError } => {
  if (!draft) return { minutes: null, error: 'durationRequired' };
  if (!/^\d+$/.test(draft)) return { minutes: null, error: 'durationInvalid' };
  const minutes = new BigNumber(draft);
  if (minutes.lt(PERPS_PRO_TWAP_MIN_MINUTES))
    return { minutes: null, error: 'durationTooShort' };
  if (minutes.gt(PERPS_PRO_TWAP_MAX_MINUTES))
    return { minutes: null, error: 'durationTooLong' };
  return { minutes: minutes.toNumber(), error: null };
};

export const getPerpsProTwapMinimum = (price: string, szDecimals: number) =>
  resolvePerpsProMinimumOrderAmount({
    minimumQuoteAmount: PERPS_PRO_TWAP_MIN_NOTIONAL,
    price,
    szDecimals,
  });

export type PerpsProTwapDraftValidation = {
  amountError: PerpsProTwapValidationError | null;
  durationError: PerpsProTwapValidationError | null;
  baseSize: string | null;
  notional: string | null;
  durationMinutes: number | null;
  valid: boolean;
};

/** Consume the direction projection's base amount, including slider input. */
export const validatePerpsProTwapDraft = ({
  baseSize,
  midPrice,
  szDecimals,
  durationDraft,
  maximumBaseSize,
}: {
  baseSize: string | null;
  midPrice: string;
  szDecimals: number;
  durationDraft: string;
  maximumBaseSize?: string | null;
}): PerpsProTwapDraftValidation => {
  const duration = parsePerpsProTwapDuration(durationDraft);
  const size = new BigNumber(baseSize || 0);
  const price = new BigNumber(midPrice);
  const maximum = new BigNumber(maximumBaseSize ?? NaN);
  let amountError: PerpsProTwapValidationError | null = null;
  let quantized: BigNumber | null = null;
  let notional: BigNumber | null = null;
  if (!Number.isSafeInteger(szDecimals) || szDecimals < 0) {
    amountError = 'invalidPrecision';
  } else if (!price.isFinite() || price.lte(0)) {
    amountError = 'priceUnavailable';
  } else if (!size.isFinite() || size.lte(0)) {
    amountError = 'amountRequired';
  } else {
    quantized = size.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
    notional = quantized.multipliedBy(price);
    if (notional.lt(PERPS_PRO_TWAP_MIN_NOTIONAL)) {
      amountError = 'amountTooSmall';
    } else if (maximum.isFinite() && maximum.gte(0) && quantized.gt(maximum)) {
      amountError = 'amountExceedsMaximum';
    }
  }
  return {
    amountError,
    durationError: duration.error,
    baseSize: quantized?.toFixed() ?? null,
    notional: notional?.toFixed() ?? null,
    durationMinutes: duration.minutes,
    valid: !amountError && !duration.error,
  };
};
