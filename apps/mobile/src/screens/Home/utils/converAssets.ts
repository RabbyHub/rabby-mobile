import BigNumber from 'bignumber.js';
import { AbstractPortfolioToken, DisplayNftItem } from '../types';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { formatNetworth } from '@/utils/math';
import { DisplayedProject } from './project';
import { ITokenItem } from '@/store/tokens';

const SMALL_TOKEN = {
  id: SMALL_TOKEN_ID,
  usd_value: 0,
} as ITokenItem;
export const convertSmallTokenList = (tokens?: ITokenItem[]) => {
  const tokensTotalValue =
    tokens
      ?.reduce((acc, item) => acc.plus(item.usd_value || 0), new BigNumber(0))
      .toNumber() || 0;
  return tokens?.length
    ? [
        {
          ...SMALL_TOKEN,
          usd_value: tokensTotalValue,
        },
        ...tokens,
      ]
    : [];
};
export const getTotalFoldToken = (
  tokens?: AbstractPortfolioToken[],
  usdRate = 1,
  symbol = '$',
) => {
  const tokensTotalValue = tokens
    ?.reduce(
      (acc, item) => acc.plus(item._isExcludeBalance ? 0 : item._usdValue || 0),
      new BigNumber(0),
    )
    ?.times(usdRate)
    .toNumber();
  return formatNetworth(tokensTotalValue, false, symbol);
};

export const getAllDefiCount = (
  portfolios: DisplayedProject[],
  usdRate = 1,
  symbol = '$',
) => {
  let tokensTotalValue = 0;
  portfolios?.forEach(portfolio => {
    // portfolio._isExcludeBalance
    tokensTotalValue += portfolio._isExcludeBalance
      ? 0
      : portfolio._portfolios
          ?.reduce(
            (acc, item) =>
              acc.plus(
                item._sumTokenRealUsdValue < 0
                  ? 0
                  : item._sumTokenRealUsdValue || 0,
              ),
            new BigNumber(0),
          )
          ?.times(usdRate)
          .toNumber();
  });
  return formatNetworth(tokensTotalValue, false, symbol);
};

export const getDisplayedPortfolioUsdValue = (
  portfolios: DisplayedProject['_portfolios'],
) => {
  return portfolios?.reduce(
    (acc, item) =>
      acc.plus(
        item._sumTokenRealUsdValue < 0 ? 0 : item._sumTokenRealUsdValue || 0,
      ),
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
