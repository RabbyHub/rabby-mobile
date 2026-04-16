import { type AbstractPortfolioToken } from '../types';
import { type CombineDefiItem } from '../hooks/store';
import { type TokenItemFromAbstractPortfolioToken } from '@/utils/token';
import { ITokenItem } from '@/store/tokens';

export const isScamHidenToken = (
  token: AbstractPortfolioToken | CombineDefiItem,
) => {
  const usdValue =
    'totalUsdValue' in token && typeof token.totalUsdValue === 'number'
      ? token.totalUsdValue
      : (token as AbstractPortfolioToken)._realUsdValue;
  return (
    !(token as TokenItemFromAbstractPortfolioToken).is_core &&
    token._isFold &&
    !usdValue
  );
};
export const isScamTokenForSelect = (token: ITokenItem) => {
  return (!token.is_core && !token.usd_value) || token.is_scam;
};
