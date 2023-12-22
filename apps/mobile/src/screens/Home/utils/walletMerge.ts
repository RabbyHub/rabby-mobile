import { calcPercent, formatNetworth } from '@/utils/math';
import { AbstractPortfolioToken } from '../types';

export const SMALL_TOKEN_ID = '_SMALL_TOKEN_';

export const mergeSmallTokens = (
  tokens?: AbstractPortfolioToken[],
  hasTokensCentiSwitch?: boolean,
  tokensThresholdIdx?: number,
) => {
  if (!tokens?.length || !hasTokensCentiSwitch) {
    return tokens;
  }

  const smallToken = {
    id: SMALL_TOKEN_ID,
    _usdValue: 0,
    _usdValueChange: 0,
    _usdValueChangeStr: '-',
  } as AbstractPortfolioToken;

  let count = 0;

  for (let i = tokensThresholdIdx!; i < tokens.length; i++) {
    smallToken._usdValue! += tokens[i]._usdValue || 0;
    smallToken._usdValueChange! += tokens[i]._usdValueChange || 0;
    count++;
  }

  const preUsdValue = smallToken._usdValue! - smallToken._usdValueChange!;
  smallToken._usdValueChangePercent = preUsdValue
    ? calcPercent(preUsdValue, smallToken._usdValue, 2, true)
    : smallToken._usdValue
    ? '+100.00%'
    : '+0.00%';

  smallToken._usdValueStr = formatNetworth(smallToken._usdValue);
  smallToken._usdValueChangeStr = smallToken._usdValueChange
    ? formatNetworth(Math.abs(smallToken._usdValueChange))
    : '-';
  smallToken.symbol = `${count} assets are hidden`;

  return [...tokens.slice(0, tokensThresholdIdx), smallToken];
};
