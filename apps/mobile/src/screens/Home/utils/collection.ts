import { type TokenItemMaybeWithOwner } from '@/databases/hooks/token';
import { type AbstractPortfolioToken } from '../types';
import { type CombineDefiItem } from '../hooks/store';
import { type TokenItemFromAbstractPortfolioToken } from '@/utils/token';

export const isScamHidenToken = (
  token: AbstractPortfolioToken | CombineDefiItem,
) => {
  const usdValue =
    typeof (token as CombineDefiItem).totalUsdValue === 'number'
      ? (token as CombineDefiItem).totalUsdValue
      : (token as AbstractPortfolioToken)._realUsdValue;
  return (
    !(token as TokenItemFromAbstractPortfolioToken).is_core &&
    token._isFold &&
    !usdValue
  );
};
export const isScamTokenForSelect = (token: TokenItemMaybeWithOwner) => {
  const netWorth = token.amount * token.price || 0;
  return (
    !token.is_core &&
    !netWorth &&
    (token as TokenItemFromAbstractPortfolioToken).isFold
  );
};
