import { coerceNumber } from './coerce';

export const abbreviateNumber = (num: any, fixed = 1) => {
  if (num === null) {
    return null;
  } // terminate early
  if (!num) {
    return '0';
  } // terminate early
  fixed = !fixed || fixed < 0 ? 0 : fixed; // number of decimal places to show
  var b = num.toPrecision(2).split('e'), // get power
    k = b.length === 1 ? 0 : Math.floor(Math.min(b[1].slice(1), 14) / 3), // floor at decimals, ceiling at trillions
    c =
      k < 1
        ? num.toFixed(0 + fixed)
        : (num / Math.pow(10, k * 3)).toFixed(0 + fixed), // divide by power
    d = c < 0 ? c : Math.abs(c), // enforce -0 is 0
    e = d + ['', 'K', 'M', 'B', 'T'][k]; // append power
  return e;
};

export const numFormat = (
  num?: string | number,
  precision?: number,
  prefix = '',
  postiveSymbol = false,
  abbreviate = true,
) => {
  if (!num) {
    return num === 0 ? `${postiveSymbol ? '+' : ''}${prefix}0` : '-';
  }

  const _num = Number(num);

  // if (Math.abs(_num) < 0.0001) {
  //   return '< 0.0001';
  // }

  if (abbreviate) {
    if (_num >= 1e9) {
      return `${prefix}${Number((_num / 1e9).toFixed(1))}B`;
    }

    // if (_num >= 1e6) {
    //   return `${prefix}${Number((_num / 1e6).toFixed(1))}M`;
    // }
  }

  const symbol = _num < 0 ? '-' : postiveSymbol ? '+' : '';
  const _precision = precision ?? (_num < 1 ? 4 : 2);
  const parts = Number(Math.abs(_num).toFixed(_precision))
    .toString()
    .split('.');

  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = parts.join('.');

  return `${symbol}${prefix}${formatted}`;
};

export function unreadCountFormat(num: string | number, limit = 99) {
  if (!num) {
    return '0';
  }

  const _num = Math.max(coerceNumber(num, 0), 0);

  if (_num <= 0) {
    return '';
  }

  if (_num <= limit) {
    return _num + '';
  }

  return `${limit}+`;
}

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

/**
 * 格式化数字
 *
 * 不能保证超出 js 运算范围的数可以正常格式化
 * @param num 数字，可以为字符串，如 '1232.123'
 * @param digit 保留小数，可以定义是否要 trim 小数中的 0
 * @param param2
 * @returns string
 */
export const formatNum = (
  num?: string | number,
  digit = 2,
  {
    floor = 0.0001,
    placeholder = '-',
    prefix = '',
    keepPostiveSign = false,
    // 从哪位符号开始缩写，对应 abbrs，0-'', 1-'k', 2-'m', 3-'b'...
    abbrStart = 3,
    trimFractionZero = true,
    abbrs = ['', 'K', 'M', 'B', 'T'],
  }: {
    floor?: number | false;
    // 只有值是 undefined / NaN / '' 才会使用 placeholder
    placeholder?: string;
    prefix?: string;
    keepPostiveSign?: boolean;
    // 从哪开始缩写
    abbrStart?: number;
    trimFractionZero?: boolean;
    abbrs?: string[];
  } = {},
) => {
  if (!num) {
    return num === 0
      ? `${keepPostiveSign ? '+' : ''}${prefix}${
          trimFractionZero ? '0' : (0).toFixed(digit)
        }`
      : placeholder;
  }

  const _num = Number(num);

  if (Number.isNaN(_num)) {
    return placeholder;
  }

  const sign = _num < 0 ? '-' : keepPostiveSign ? '+' : '';
  const absNum = Math.abs(_num);

  if (absNum < (floor as number)) {
    return `<${sign}${prefix}${floor}`;
  }

  const pow = (Math.log10(absNum) / 3) | 0;
  const _pow = abbrStart <= pow ? pow : 0;
  const realPow = _pow < abbrs.length ? _pow : abbrs.length - 1;
  const suffix = abbrs[realPow];

  const roundedNum = (absNum / Math.pow(10, 3 * realPow)).toFixed(digit);

  const parts = roundedNum.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  parts[1] =
    parts[1] && trimFractionZero ? parts[1].replace(/0+$/, '') : parts[1];
  const formatted = parts[1] ? parts.join('.') : parts[0];

  return `${sign}${prefix}${formatted}${suffix}`;
};

// -> assets
export const formatNetworth = (
  num?: number,
  trimFractionZero = false,
  prefix = '$',
) => {
  if (!num && num !== 0) {
    return '';
  }

  // >1b || <1m
  if (num > 1000000000 || num < 1000000) {
    return formatNum(num, 2, { prefix, floor: 0.01, trimFractionZero });
  }

  // 1m
  return formatNum(num, 0, { prefix, trimFractionZero });
};

export const formatPriceMainsite = (num?: number) => {
  if (!num && num !== 0) {
    return '';
  }

  // >1
  if (num >= 1) {
    return formatNum(num, 2, { prefix: '$', trimFractionZero: false });
  }

  const preNum = num.toPrecision(4);

  if (preNum.toString().length > 10) {
    const exNum = num.toExponential(4);

    return `$${exNum}`;
  }

  return `$${preNum}`;
};

export const formatAmount = (num?: number, keepPostiveSign?: boolean) => {
  if (!num && num !== 0) {
    return '';
  }

  const absNum = Math.abs(num);

  if (absNum < 1) {
    const sign = num >= 0 && keepPostiveSign ? '+' : '';

    if (num === 0) {
      return `${sign}0.0000`;
    }

    const preNum = num.toPrecision(4);

    if (preNum.toString().length > 10) {
      const exNum = num.toExponential(4);

      return `${sign}${exNum}`;
    }

    return `${sign}${preNum}`;
  }

  // >= 1
  // >1b || <10k
  if (absNum > 1000000000 || absNum < 10000) {
    return formatNum(num, 4, { trimFractionZero: false, keepPostiveSign });
  }

  // <1m
  if (absNum < 1000000) {
    return formatNum(num, 2, { trimFractionZero: false, keepPostiveSign });
  }

  return formatNum(num, 0, { trimFractionZero: false, keepPostiveSign });
};

// <- assets

//number 1-9999之间 转换为英文单词
export const numberToWords = (num: number): string => {
  const words = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
    'hundred',
    'thousand',
  ];
  if (num < 21) {
    return words[num];
  }
  if (num < 100) {
    return (
      words[Math.floor(num / 10) + 18] +
      (num % 10 ? ' ' + numberToWords(num % 10) : '')
    );
  }
  if (num < 1000) {
    return (
      numberToWords(Math.floor(num / 100)) +
      ' ' +
      words[28] +
      (num % 100 ? ' ' + numberToWords(num % 100) : '')
    );
  }
  if (num < 10000) {
    return (
      numberToWords(Math.floor(num / 1000)) +
      ' ' +
      words[29] +
      (num % 1000 ? ' ' + numberToWords(num % 1000) : '')
    );
  }
  return 'Number out of range';
};
