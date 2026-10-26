import BigNumber from 'bignumber.js';

import { normalizePerpsProMarketSourceTag } from './market';
import type { PerpsProTradeAmountUnit } from './trade';

export interface PerpsProCloseMarketSnapshot {
  displayBase: string;
  displayPair: string;
  markPrice: string;
  midPrice: string;
  pxDecimals: number;
  quoteAsset: string;
  sourceTag: string | null;
  szDecimals: number;
}

export interface PerpsProCloseDraft {
  inputSource: 'manual' | 'slider';
  limitPrice: string | null;
  midPrice: string;
  orderType: 'limit' | 'market';
  percent: number;
  referencePrice: string;
  size: string;
}

export const resolvePerpsProCloseMarketSourceTag = (
  sourceTag: string | null | undefined,
) => normalizePerpsProMarketSourceTag(sourceTag);

const positive = (value: string) => {
  const result = new BigNumber(value || Number.NaN);
  return result.isFinite() && result.gt(0) ? result : null;
};

export const resolvePerpsProCloseSize = ({
  amountUnit,
  inputSource,
  manualAmount,
  percent,
  positionSize,
  referencePrice,
  szDecimals,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  inputSource: PerpsProCloseDraft['inputSource'];
  manualAmount: string;
  percent: number;
  positionSize: string;
  referencePrice: string;
  szDecimals: number;
}): string | null => {
  const position = positive(positionSize);
  if (!position || !Number.isSafeInteger(szDecimals) || szDecimals < 0) {
    return null;
  }
  let requested: BigNumber | null;
  if (inputSource === 'slider') {
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return null;
    }
    requested = position.multipliedBy(percent).dividedBy(100);
  } else {
    const amount = positive(manualAmount);
    if (!amount) {
      return null;
    }
    if (amountUnit === 'base') {
      requested = amount;
    } else {
      const price = positive(referencePrice);
      requested = price ? amount.dividedBy(price) : null;
    }
  }
  if (!requested || requested.gt(position)) {
    return null;
  }
  const normalized = requested.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
  return normalized.gt(0) ? normalized.toFixed() : null;
};
