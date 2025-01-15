import BigNumber from 'bignumber.js';
import { AbstractPortfolioToken, DisplayNftItem } from '../types';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { formatNetworth } from '@/utils/math';
import { DisplayedProject } from './project';

const SMALL_TOKEN = {
  id: SMALL_TOKEN_ID,
  _usdValue: 0,
  _usdValueChangeStr: '-',
} as AbstractPortfolioToken;
export const convertSmallTokenList = (tokens?: AbstractPortfolioToken[]) => {
  const tokensTotalValue = tokens
    ?.reduce(
      (acc, item) => acc.plus(item._isExcludeBalance ? 0 : item._usdValue || 0),
      new BigNumber(0),
    )
    .toNumber();
  return tokens?.length
    ? [
        {
          ...SMALL_TOKEN,
          _usdValue: tokensTotalValue,
          _usdValueStr: formatNetworth(tokensTotalValue),
        },
        ...tokens,
      ]
    : [];
};
export const getTotalFoldToken = (tokens?: AbstractPortfolioToken[]) => {
  const tokensTotalValue = tokens
    ?.reduce(
      (acc, item) => acc.plus(item._isExcludeBalance ? 0 : item._usdValue || 0),
      new BigNumber(0),
    )
    .toNumber();
  return formatNetworth(tokensTotalValue);
};

export const getAllDefiCount = (portfolios: DisplayedProject[]) => {
  let tokensTotalValue = 0;
  portfolios?.forEach(portfolio => {
    // portfolio._isExcludeBalance
    tokensTotalValue += portfolio._isExcludeBalance
      ? 0
      : portfolio._portfolios
          ?.reduce(
            (acc, item) => acc.plus(item._sumTokenRealUsdValue || 0),
            new BigNumber(0),
          )
          .toNumber();
  });
  return formatNetworth(tokensTotalValue);
};

export const getDisplayedPortfolioUsdValue = (
  portfolios: DisplayedProject['_portfolios'],
) => {
  return portfolios?.reduce(
    (acc, item) => acc.plus(item._sumTokenRealUsdValue || 0),
    new BigNumber(0),
  );
};

export const getAllNftCount = (nfts: DisplayNftItem[]) => {
  let total = 0;
  nfts.forEach(nft => {
    total += nft.amount;
  });
  return total;
};
