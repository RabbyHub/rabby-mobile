import { SQLiteDriverType } from '@/core/databases/exports';
import { stringUtils } from '@rabby-wallet/base-utils';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';
import BigNumber from 'bignumber.js';
import { DeleteResult, ValueTransformer } from 'typeorm/browser';
import { makeJsEEClass } from '@/core/services/_utils';

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
    if (!decimals) return 0;
    if (typeof decimals === 'string') {
      const maybeValidInt = parseInt(decimals);
      if (Number.isNaN(maybeValidInt)) return decimals;

      decimals = maybeValidInt;
    }

    if (Number.isNaN(decimals)) return 0;

    return decimals * DECIMALS_INT_RATIO;
  },
  from: (int?: number | string) => {
    if (!int) return 0;
    if (typeof int === 'string') {
      const maybeValidInt = parseInt(int);
      if (Number.isNaN(maybeValidInt)) return int;

      int = maybeValidInt;
    }

    if (Number.isNaN(int)) return 0;

    return int / DECIMALS_INT_RATIO;
  },
};

export function correctBadRealOnSql(
  columnName: `tokenitem.price` | `tokenitem.amount`,
) {
  return `(${columnName} / ${DECIMALS_INT_RATIO})`;
}

/**
 * @description should used with TEXT column type
 */
export const jsonTransformer: ValueTransformer = {
  to: (val: any) => {
    // avoid duplicate stringify
    if (typeof val === 'string') return val;
    return columnConverter.jsonObjToString(val);
  },
  from: (val: any) => columnConverter.jsonStringToObj(val),
};

/**
 * @description should used with TEXT column type
 */
export const bigNumberTransformer: ValueTransformer = {
  to: (val: any) =>
    BigNumber.isBigNumber(val) ? val.toString() : new BigNumber(val).toString(),
  from: (val: any) => new BigNumber(val),
};

export const RECOMMENDED_DEFAULT_QUERY_LIMIT =
  SQLiteDriverType === 'RNSQLiteStorage' ? 200 : 500;

export type OrmEventBusListeners = {
  [`account_info:removed`]: (ctx: { deleteResult: DeleteResult }) => void;
};
const { EventEmitter: OrmEE } = makeJsEEClass<OrmEventBusListeners>();
export const ormEvents = new OrmEE();
