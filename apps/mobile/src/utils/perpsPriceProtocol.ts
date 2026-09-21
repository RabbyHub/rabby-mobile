import BigNumber from 'bignumber.js';

const PERPS_MAX_PRICE_DECIMALS = 6;
const PERPS_MAX_PRICE_SIGNIFICANT_FIGURES = 5;

const decimal = (value: BigNumber.Value) => {
  const result = new BigNumber(value);
  return result.isFinite() ? result : null;
};

const sanitizeDecimalInputWithPolicy = (
  value: string,
  maxDecimals: number,
  preserveIntegerZeroRun: boolean,
) => {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [integer = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, Math.max(0, maxDecimals));
  const hasDecimal = normalized.includes('.') && maxDecimals > 0;
  const integerValue =
    preserveIntegerZeroRun && !hasDecimal && /^0{2,}$/u.test(integer)
      ? integer
      : integer.replace(/^0+(?=\d)/, '') || (hasDecimal ? '0' : '');
  return hasDecimal ? `${integerValue}.${fraction}` : integerValue;
};

export const sanitizePerpsProDecimalInput = (
  value: string,
  maxDecimals: number,
) => sanitizeDecimalInputWithPolicy(value, maxDecimals, false);

export const sanitizePerpsProDecimalEditingInput = (
  value: string,
  maxDecimals: number,
  preserveIntegerZeroRun = false,
) => sanitizeDecimalInputWithPolicy(value, maxDecimals, preserveIntegerZeroRun);

export const getPerpsProPriceInputMaxDecimals = (szDecimals: number) =>
  Number.isSafeInteger(szDecimals) && szDecimals >= 0
    ? Math.max(0, PERPS_MAX_PRICE_DECIMALS - szDecimals)
    : 0;

const sanitizeNormalizedPriceInput = (normalized: string) => {
  if (!normalized.includes('.')) {
    return normalized;
  }
  const preservesIncompleteDecimal = normalized.endsWith('.');
  const [integer, fraction = ''] = normalized.split('.');
  let acceptedFraction = '';
  for (const digit of fraction) {
    const significantDigits = `${integer}${acceptedFraction}${digit}`.replace(
      /^0+/u,
      '',
    );
    if (significantDigits.length > PERPS_MAX_PRICE_SIGNIFICANT_FIGURES) {
      break;
    }
    acceptedFraction += digit;
  }
  return acceptedFraction || preservesIncompleteDecimal
    ? `${integer}.${acceptedFraction}`
    : integer;
};

export const sanitizePerpsProPriceInput = (value: string, szDecimals: number) =>
  sanitizeNormalizedPriceInput(
    sanitizePerpsProDecimalInput(
      value,
      getPerpsProPriceInputMaxDecimals(szDecimals),
    ),
  );

export const sanitizePerpsProPriceEditingInput = (
  value: string,
  szDecimals: number,
) =>
  sanitizeNormalizedPriceInput(
    sanitizePerpsProDecimalEditingInput(
      value,
      getPerpsProPriceInputMaxDecimals(szDecimals),
      true,
    ),
  );

export const isPerpsProPriceProtocolValid = (
  value: string,
  szDecimals: number,
) => {
  if (
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0 ||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)
  ) {
    return false;
  }
  return (
    sanitizePerpsProPriceInput(value, szDecimals) === value &&
    !!decimal(value)?.gt(0)
  );
};

/** Normalize a calculated price; direct user input must use the validator. */
export const normalizePerpsProCalculatedPrice = (
  value: BigNumber.Value,
  szDecimals: number,
): string | null => {
  const price = decimal(value);
  if (!price?.gt(0) || !Number.isSafeInteger(szDecimals) || szDecimals < 0) {
    return null;
  }
  if (price.isInteger()) {
    return price.toFixed(0);
  }
  const significant = new BigNumber(
    price.toPrecision(
      PERPS_MAX_PRICE_SIGNIFICANT_FIGURES,
      BigNumber.ROUND_DOWN,
    ),
  );
  const normalized = significant.decimalPlaces(
    getPerpsProPriceInputMaxDecimals(szDecimals),
    BigNumber.ROUND_DOWN,
  );
  const result = normalized.gt(0) ? normalized.toFixed() : null;
  return result && isPerpsProPriceProtocolValid(result, szDecimals)
    ? result
    : null;
};
