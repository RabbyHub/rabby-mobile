import { stringUtils } from '@rabby-wallet/base-utils';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';
import BigNumber from 'bignumber.js';
import { ValueTransformer } from 'typeorm/browser';

export const DECIMALS_INT_RATIO = 18;

export const columnConverter = {
  numberToString(num?: number | string) {
    if (num === undefined) {
      return '';
    }
    return num.toString();
  },

  jsonObjToString(obj: any) {
    if (!obj) {
      return '';
    }
    return JSON.stringify(obj);
  },

  jsonStringToObj(str: string) {
    return safeParseJSON(str);
  },

  stringToNumber(str?: string, isFloat?: boolean) {
    if (!str) {
      return 0;
    }

    const num = isFloat ? parseFloat(str) : parseInt(str);

    if (Number.isNaN(num)) {
      return 0;
    }

    return num;
  },
};

/**
 * @deprecated bad/incorrect implementation, should not use this
 */
export const badRealTransformer: ValueTransformer = {
  to: (decimals?: number | string) => {
    if (!decimals) {
      return 0;
    }
    if (typeof decimals === 'string') {
      decimals = parseInt(decimals);
    }

    if (Number.isNaN(decimals)) {
      return 0;
    }

    return decimals * DECIMALS_INT_RATIO;
  },
  from: (int?: number | string) => {
    if (!int) {
      return 0;
    }
    if (typeof int === 'string') {
      int = parseInt(int);
    }

    if (Number.isNaN(int)) {
      return 0;
    }

    return int / DECIMALS_INT_RATIO;
  },
};

export function correctBadRealOnSql(columnName: string) {
  return `(${columnName} / ${DECIMALS_INT_RATIO})`;
}

/**
 * @description should used with TEXT column type
 */
export const jsonTransformer: ValueTransformer = {
  to: (val: any) => JSON.stringify(val),
  from: (val: any) => stringUtils.safeParseJSON(val),
};

/**
 * @description should used with TEXT column type
 */
export const bigNumberTransformer: ValueTransformer = {
  to: (val: any) =>
    BigNumber.isBigNumber(val) ? val.toString() : new BigNumber(val).toString(),
  from: (val: any) => new BigNumber(val),
};
