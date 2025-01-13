const DECIMALS_INT_RATIO = 18;

export const columnConverter = {
  numberToString(num?: number | string) {
    if (num === undefined) return '';
    return num.toString();
  },

  stringToNumber(str?: string, isFloat?: boolean) {
    if (!str) return 0;

    const num = isFloat ? parseFloat(str) : parseInt(str);

    if (Number.isNaN(num)) {
      return 0;
    }

    return num;
  },

  decimalsToInteger(decimals?: number | string) {
    if (!decimals) return 0;
    if (typeof decimals === 'string') {
      decimals = parseInt(decimals);
    }

    if (Number.isNaN(decimals)) {
      return 0;
    }

    return decimals * DECIMALS_INT_RATIO;
  },

  intToDecimals(int?: number | string) {
    if (!int) return 0;
    if (typeof int === 'string') {
      int = parseInt(int);
    }

    if (Number.isNaN(int)) {
      return 0;
    }

    return int / DECIMALS_INT_RATIO;
  },
};

export const realTransformer = {
  to: (val: any) => columnConverter.decimalsToInteger(val),
  from: (val: any) => columnConverter.intToDecimals(val),
};
