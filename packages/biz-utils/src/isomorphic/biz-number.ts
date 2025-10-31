import BigNumber from 'bignumber.js';

const Sub_Numbers = '₀₁₂₃₄₅₆₇₈₉';

export const splitNumberByStep = (
  num: number | string,
  step = 3,
  symbol = ',',
  forceInt = false,
) => {
  const fmt: BigNumber.Format = {
    decimalSeparator: '.',
    groupSeparator: symbol,
    groupSize: step,
  };
  const n = new BigNumber(num);
  // hide the after-point part if number is more than 1000000
  if (n.isGreaterThan(1000000) || forceInt) {
    return n.decimalPlaces(0).toFormat(fmt);
  }
  return n.toFormat(fmt);
};

export const formatLittleNumber = (num: string, minLen = 6) => {
  const bn = new BigNumber(num);
  if (bn.toFixed().length >= minLen) {
    const s = bn.precision(4).toFormat();
    const ss = s.replace(/^0.(0*)?(?:.*)/u, (_, z: string) => {
      const zeroLength = z.length;

      const sub = `${zeroLength}`
        .split('')
        .map(x => Sub_Numbers[x as any])
        .join('');

      const end = s.slice(zeroLength + 2);
      return `0.0${sub}${end}`;
    });

    return ss;
  }
  return num;
};

export const formatTokenAmount = (
  amount: number | string | BigNumber,
  decimals = 4,
  moreDecimalsWhenNotEnough = false, // when number less then 0.0001, auto change decimals to 8
) => {
  if (!amount) {
    return '0';
  }
  const bn = new BigNumber(amount);
  const str = bn.toFixed();
  const split = str.split('.');
  let realDecimals = decimals;
  if (moreDecimalsWhenNotEnough && bn.lt(0.0001) && decimals < 8) {
    realDecimals = 8;
  }
  if (bn.lte(0.0001)) {
    return formatLittleNumber(bn.toFixed());
  }
  if (!split[1] || split[1].length < realDecimals) {
    return splitNumberByStep(bn.toFixed());
  }
  return splitNumberByStep(bn.toFixed(realDecimals));
};

export const numberWithCommasIsLtOne = (
  x?: number | string | BigNumber,
  precision?: number,
) => {
  if (x === undefined || x === null) {
    return '-';
  }
  if (x.toString() === '0') {
    return '0';
  }

  if ((x as number) < 0.00005) {
    return '< 0.0001';
  }
  precision = (x as number) < 1 ? 4 : precision ?? 2;
  const parts: string[] = Number(x).toFixed(precision).split('.');

  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

export const formatNumber = (
  num: string | number | BigNumber,
  decimal = 2,
  opt = {} as BigNumber.Format,
  formatMillion = false,
) => {
  const n = new BigNumber(num);
  const format = {
    prefix: '',
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0,
    suffix: '',
    ...opt,
  };
  // hide the after-point part if number is more than 1000000
  if (n.isGreaterThan(1000000)) {
    if (n.gte(1e9)) {
      return `${n.div(1e9).toFormat(decimal, format)}B`;
    }
    if (formatMillion) {
      return `${n.div(1e6).toFormat(decimal, format)}M`;
    }
    return n.decimalPlaces(0).toFormat(format);
  }
  return n.toFormat(decimal, format);
};

export const formatPrice = (
  price: string | number,
  len = 4,
  formatThousand = false,
) => {
  if (
    formatThousand &&
    (price as number) >= 1000 &&
    (price as number) <= 1000000
  ) {
    return formatNumber(price, 0);
  }
  if ((price as number) >= 0.1) {
    return formatNumber(price, (price as number) > 1 ? 2 : 4);
  }
  if ((price as number) < 0.0001) {
    return formatLittleNumber(new BigNumber(price).toFixed(), 6);
  }
  return formatNumber(price, len);
};

export const intToHex = (n: number) => {
  if (n % 1 !== 0) {
    throw new Error(`${n} is not int`);
  }
  return `0x${n.toString(16)}`;
};

export const formatUsdValue = (
  value: string | number,
  decimal?: number,
  formatMillion?: boolean,
) => {
  const bnValue = new BigNumber(value);
  if (bnValue.lt(0)) {
    return `-$${formatNumber(
      Math.abs(Number(value)),
      decimal,
      {},
      formatMillion,
    )}`;
  }
  if (bnValue.gte(0.01) || bnValue.eq(0)) {
    return `$${formatNumber(value, decimal, {}, formatMillion)}`;
  }
  return '<$0.01';
};

export const formatCurrency = (
  value: string | number,
  options?: {
    decimal?: number;
    formatMillion?: boolean;
    currency?: {
      symbol: string;
      code: string;
      logo_url: string;
      usd_rate: number;
    };
  },
) => {
  const {
    decimal,
    formatMillion,
    currency = {
      code: 'USD',
      symbol: '$',
      usd_rate: 1,
    },
  } = options || {};
  const bnValue = new BigNumber(value).times(currency.usd_rate);
  const { symbol } = currency;
  if (bnValue.lt(0)) {
    return `-${symbol}${formatNumber(
      bnValue.absoluteValue(),
      decimal,
      {},
      formatMillion,
    )}`;
  }
  if (bnValue.gte(0.01) || bnValue.eq(0)) {
    return `${symbol}${formatNumber(bnValue, decimal, {}, formatMillion)}`;
  }
  return `<${symbol}0.01`;
};

export const formatPerpsNumber = (
  num: string | number,
  decimal = 2,
  opt = {} as BigNumber.Format,
  roundingMode = BigNumber.ROUND_HALF_UP as BigNumber.RoundingMode,
) => {
  const n = new BigNumber(num);
  const format = {
    prefix: '',
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0,
    suffix: '',
    ...opt,
  };
  if (n.isNaN()) {
    return num.toString();
  }
  // hide the after-point part if number is more than 1000000
  if (n.isGreaterThan(1000000)) {
    if (n.gte(1e9)) {
      return `${n.div(1e9).toFormat(decimal, roundingMode, format)}B`;
    }
    return n.decimalPlaces(0).toFormat(format);
  }
  return n.toFormat(decimal, roundingMode, format);
};

export const formatPerpsUsdValue = (
  value: string | number,
  roundingMode = BigNumber.ROUND_HALF_UP as BigNumber.RoundingMode,
) => {
  const bnValue = new BigNumber(value);
  if (bnValue.lt(0)) {
    return `-$${formatPerpsNumber(
      Math.abs(Number(value)),
      2,
      undefined,
      roundingMode,
    )}`;
  }
  if (bnValue.gte(0.01) || bnValue.eq(0)) {
    return `$${formatPerpsNumber(value, 2, undefined, roundingMode)}`;
  }
  return '<$0.01';
};

export const formatAmount = (amount: string | number, decimals = 4) => {
  if ((amount as number) > 1e9) {
    return `${new BigNumber(amount).div(1e9).toFormat(4)}B`;
  }
  if ((amount as number) > 10000) {
    return formatNumber(amount);
  }
  if ((amount as number) > 1) {
    return formatNumber(amount, 4);
  }
  if ((amount as number) < 0.0001) {
    const str = new BigNumber(amount).toFixed();
    return formatLittleNumber(str);
  }
  return formatNumber(amount, decimals);
};

export const calcPercent = (
  pre?: number,
  next?: number,
  precision = 2,
  needSign = true,
) => {
  const delta = (next || 0) - (pre || 0);
  const percent = pre
    ? ((delta / pre) * 100).toFixed(precision)
    : next
    ? '100.00'
    : '0.00';

  return `${needSign && delta >= 0 ? '+' : ''}${percent}%`;
};

export function coerceInteger(input: any, fallbackInt = 0) {
  const output = parseInt(input, 10);

  if (Number.isNaN(output)) {
    return fallbackInt;
  }

  return output;
}

export function coerceFloat(input: any, fallbackNum = 0) {
  const output = parseFloat(input);

  if (Number.isNaN(output)) {
    return fallbackNum;
  }

  return output;
}

export const ALLOWED_NUMBIC_INPUT = /^\d*(\.|\,)?\d*$/;
export const EXTRACT_AMOUNT_REGEX = /^[0-9]+(\.|\,)\d*/;
export function formatSpeicalAmount(input: number | string) {
  const inputStr = String(input);

  const matched = inputStr.match(EXTRACT_AMOUNT_REGEX);

  const firstSep = matched?.[1];
  if (firstSep && firstSep !== '.') {
    return inputStr.replace(new RegExp(firstSep), '.');
  }

  return input.toString();
}

export const formatGasHeaderUsdValue = (value: string | number) => {
  const bnValue = new BigNumber(value);
  if (bnValue.lt(0)) {
    return `-$${formatNumber(Math.abs(Number(value)))}`;
  }
  if (bnValue.gte(0.01)) {
    return `$${formatNumber(value)}`;
  }
  if (bnValue.lt(0.0001)) {
    return '<$0.0001';
  }

  return `$${formatNumber(value, 4)}`;
};

export const formatGasCostUsd = (gasCostUsd: BigNumber) => {
  const bn = gasCostUsd!;
  let value;

  if (bn.gt(1)) {
    value = bn.toFixed(2);
  } else if (bn.gt(0.0001)) {
    value = bn.toFixed(4);
  } else {
    value = '0.0001';
  }

  return formatTokenAmount(value);
};
