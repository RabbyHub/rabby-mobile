import BigNumber from 'bignumber.js';

import type { PerpsProTradeAmountUnit } from './trade';

export interface PerpsProTradeAmountDraft {
  baseAmount: string;
  inputSource: PerpsProTradeAmountUnit | null;
  quoteAmount: string;
}

export const createPerpsProTradeAmountDraft = (): PerpsProTradeAmountDraft => ({
  baseAmount: '',
  inputSource: null,
  quoteAmount: '',
});

const positive = (value: string) => {
  const result = new BigNumber(value || Number.NaN);
  return result.isFinite() && result.gt(0) ? result : null;
};

export const updatePerpsProTradeAmountDraft = ({
  amount,
  amountUnit,
  price,
  szDecimals,
}: {
  amount: string;
  amountUnit: PerpsProTradeAmountUnit;
  price: string;
  szDecimals: number;
}): PerpsProTradeAmountDraft => {
  const amountValue = positive(amount);
  const priceValue = positive(price);
  const canConvert =
    !!amountValue &&
    !!priceValue &&
    Number.isSafeInteger(szDecimals) &&
    szDecimals >= 0;

  if (amountUnit === 'quote') {
    const baseAmount = canConvert
      ? amountValue
          .dividedBy(priceValue)
          .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN)
          .toFixed()
      : '';
    return {
      baseAmount: positive(baseAmount) ? baseAmount : '',
      inputSource: 'quote',
      quoteAmount: amount,
    };
  }

  const quoteAmount = canConvert
    ? amountValue
        .multipliedBy(priceValue)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toFixed(2)
    : '';
  return {
    baseAmount: amount,
    inputSource: 'base',
    quoteAmount: positive(quoteAmount) ? quoteAmount : '',
  };
};

export const repricePerpsProTradeAmountDraft = ({
  draft,
  price,
  szDecimals,
}: {
  draft: PerpsProTradeAmountDraft;
  price: string;
  szDecimals: number;
}) => {
  if (!draft.inputSource) return draft;
  return updatePerpsProTradeAmountDraft({
    amount: draft.inputSource === 'base' ? draft.baseAmount : draft.quoteAmount,
    amountUnit: draft.inputSource,
    price,
    szDecimals,
  });
};

export const getPerpsProTradeAmountDraftDisplay = (
  draft: PerpsProTradeAmountDraft,
  amountUnit: PerpsProTradeAmountUnit,
) => (amountUnit === 'base' ? draft.baseAmount : draft.quoteAmount);
