import { TokenItemMaybeWithOwner } from '@/databases/hooks/token';
import { AbstractPortfolioToken } from '../types';

export const isScamHidenToken = (token: AbstractPortfolioToken) => {
  const usdValue =
    typeof token.totalUsdValue === 'number'
      ? token.totalUsdValue
      : token._realUsdValue;
  return !token.is_core && token._isFold && !usdValue;
};
export const isScamTokenForSelect = (token: TokenItemMaybeWithOwner) => {
  const netWorth = token.amount * token.price || 0;
  return !token.is_core && !netWorth && token.isFold;
};
