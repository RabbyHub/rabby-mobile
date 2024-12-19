import BigNumber from 'bignumber.js';
import { AbstractPortfolioToken } from '../types';
import { SMALL_TOKEN_ID, DEFI_ID, NFT_ID } from '@/utils/token';
import { formatNetworth } from '@/utils/math';
import { DisplayedProject } from '../utils/project';

const SMALL_TOKEN = {
  id: SMALL_TOKEN_ID,
  _usdValue: 0,
  _usdValueChangeStr: '-',
} as AbstractPortfolioToken;
export const convertSmallTokenList = (tokens?: AbstractPortfolioToken[]) => {
  const tokensTotalValue = tokens
    ?.reduce((acc, item) => acc.plus(item._usdValue || 0), new BigNumber(0))
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
export const convertDefiAssets = (portfolios: DisplayedProject[]) => {
  let tokensTotalValue = 0;
  portfolios.forEach(portfolio => {
    tokensTotalValue += portfolio._portfolios
      ?.reduce(
        (acc, item) => acc.plus(item._sumTokenRealUsdValue || 0),
        new BigNumber(0),
      )
      .toNumber();
  });
  return portfolios?.length
    ? [
        {
          id: DEFI_ID,
          _usdValue: tokensTotalValue,
          _usdValueStr: formatNetworth(tokensTotalValue),
        } as unknown as DisplayedProject[],
        ...portfolios,
      ]
    : [];
};
