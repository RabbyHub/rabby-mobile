import BigNumber from 'bignumber.js';

import type { PerpsProBboStrategy } from './bbo';
import {
  createPerpsProAttachedTpSlDraft,
  getPerpsProAttachedTpSlCompatibilityError,
  type PerpsProAttachedTpSlDraft,
} from './tpsl';

export type PerpsProTradeAmountUnit = 'base' | 'quote';
export type PerpsProTradeOrderType = 'conditional' | 'limit' | 'market';
export type PerpsProTradeTif = 'Alo' | 'Gtc' | 'Ioc';
export type PerpsProTradeSide = 'buy' | 'sell';
export type PerpsProConditionalExecution = 'limit' | 'market';

export interface PerpsProTradeFormState {
  amount: string;
  amountUnit: PerpsProTradeAmountUnit;
  attachedTpSl: PerpsProAttachedTpSlDraft;
  bboEnabled: boolean;
  bboStrategy: PerpsProBboStrategy;
  conditionalExecution: PerpsProConditionalExecution;
  conditionalLimitPrice: string;
  limitPrice: string;
  orderType: PerpsProTradeOrderType;
  reduceOnly: boolean;
  tif: PerpsProTradeTif;
  triggerPrice: string;
}

export interface PerpsProResolvedTradeAmount {
  baseSize: string;
  quoteAmount: string;
}

export type PerpsProConditionalClassification = 'sl' | 'tp';

const decimal = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() ? result : null;
};

export const sanitizePerpsProDecimalInput = (
  value: string,
  maxDecimals: number,
) => {
  const normalized = value.replace(/[^\d.]/g, '');
  const [integer = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, Math.max(0, maxDecimals));
  const hasDecimal = normalized.includes('.') && maxDecimals > 0;
  const integerValue =
    integer.replace(/^0+(?=\d)/, '') || (hasDecimal ? '0' : '');
  return hasDecimal ? `${integerValue}.${fraction}` : integerValue;
};

export const resolvePerpsProTradeAmount = ({
  amount,
  amountUnit,
  price,
  szDecimals,
}: {
  amount: string;
  amountUnit: PerpsProTradeAmountUnit;
  price: string;
  szDecimals: number;
}): PerpsProResolvedTradeAmount | null => {
  const amountValue = decimal(amount);
  const priceValue = decimal(price);
  if (
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0 ||
    !amountValue ||
    !priceValue ||
    amountValue.lte(0) ||
    priceValue.lte(0)
  ) {
    return null;
  }
  const base = (
    amountUnit === 'base' ? amountValue : amountValue.dividedBy(priceValue)
  ).decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
  if (base.lte(0)) {
    return null;
  }
  return {
    baseSize: base.toFixed(),
    quoteAmount: base.multipliedBy(priceValue).toFixed(),
  };
};

export const resolvePerpsProDisplayAmount = ({
  amountUnit,
  baseAmount,
  price,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  baseAmount: string;
  price: string | null;
}) => {
  const base = decimal(baseAmount);
  if (!base || base.lt(0)) return null;
  if (amountUnit === 'base') return base.toFixed();
  const quotePrice = decimal(price);
  return quotePrice?.gt(0) ? base.multipliedBy(quotePrice).toFixed() : null;
};

export const inferPerpsProConditionalClassification = ({
  isBuy,
  referencePrice,
  triggerPrice,
}: {
  isBuy: boolean;
  referencePrice: string;
  triggerPrice: string;
}): PerpsProConditionalClassification | null => {
  const reference = decimal(referencePrice);
  const trigger = decimal(triggerPrice);
  if (!reference || !trigger || reference.lte(0) || trigger.lte(0)) {
    return null;
  }
  const comparison = trigger.comparedTo(reference);
  if (comparison === 0) {
    return null;
  }
  return isBuy ? (comparison > 0 ? 'sl' : 'tp') : comparison < 0 ? 'sl' : 'tp';
};

export const getPerpsProTradeExecutionPrice = ({
  bboPrice,
  form,
  marketPrice,
}: {
  bboPrice: string | null;
  form: PerpsProTradeFormState;
  marketPrice: string;
}) => {
  if (form.orderType === 'market') {
    return marketPrice;
  }
  if (form.orderType === 'limit') {
    return form.bboEnabled ? bboPrice : form.limitPrice;
  }
  return form.conditionalExecution === 'limit'
    ? form.conditionalLimitPrice
    : marketPrice;
};

export const getPerpsProAmountInputDecimals = ({
  amountUnit,
  szDecimals,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  szDecimals: number;
}) => (amountUnit === 'base' ? Math.max(0, szDecimals) : 2);

export const isPerpsProTradeCombinationSupported = (
  form: PerpsProTradeFormState,
) => {
  if (
    form.attachedTpSl.enabled &&
    getPerpsProAttachedTpSlCompatibilityError(form)
  ) {
    return false;
  }
  if (form.orderType === 'market') {
    return true;
  }
  if (form.orderType === 'limit') {
    return !form.bboEnabled || form.tif === 'Gtc';
  }
  return !form.attachedTpSl.enabled;
};

export const createPerpsProTradeFormState = ({
  amountUnit = 'quote',
  orderType = 'market',
}: {
  amountUnit?: PerpsProTradeAmountUnit;
  orderType?: PerpsProTradeOrderType;
} = {}): PerpsProTradeFormState => ({
  amount: '',
  amountUnit,
  attachedTpSl: createPerpsProAttachedTpSlDraft(),
  bboEnabled: false,
  bboStrategy: 'cp1',
  conditionalExecution: 'market',
  conditionalLimitPrice: '',
  limitPrice: '',
  orderType,
  reduceOnly: false,
  tif: 'Gtc',
  triggerPrice: '',
});
