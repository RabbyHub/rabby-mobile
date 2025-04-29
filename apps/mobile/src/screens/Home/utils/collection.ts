import { AbstractPortfolioToken } from '../types';

export const isScamHidenToken = (token: AbstractPortfolioToken) => {
  const usdValue =
    typeof token.totalUsdValue === 'number'
      ? token.totalUsdValue
      : token._realUsdValue;
  return !token.is_core && token._isFold && !usdValue;
};
