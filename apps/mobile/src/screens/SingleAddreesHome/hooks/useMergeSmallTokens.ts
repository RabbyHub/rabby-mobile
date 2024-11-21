import { useExpandList } from '@/hooks/useExpandList';
import { formatNetworth } from '@/utils/math';
import BigNumber from 'bignumber.js';
import React from 'react';
import { AbstractPortfolioToken } from '../types';
import { SMALL_TOKEN_ID } from '@/utils/token';

const SMALL_TOKEN = {
  id: SMALL_TOKEN_ID,
  _usdValue: 0,
  // TODO
  _usdValueChange: 0,
  _usdValueChangeStr: '-',
} as AbstractPortfolioToken;

export const useMergeSmallTokens = (tokens?: AbstractPortfolioToken[]) => {
  const [mainTokens, setMainTokens] = React.useState<AbstractPortfolioToken[]>(
    [],
  );
  const tokensTotalValue = React.useMemo(() => {
    return tokens
      ?.reduce((acc, item) => acc.plus(item._usdValue || 0), new BigNumber(0))
      .toNumber();
  }, [tokens]);
  const { result } = useExpandList(tokens, tokensTotalValue);
  const smallTokens = React.useMemo(() => {
    return tokens?.filter(item => result?.indexOf(item) === -1);
  }, [tokens, result]);

  const smallTokensTotalValue = React.useMemo(() => {
    return smallTokens
      ?.reduce((acc, item) => acc.plus(item._usdValue || 0), new BigNumber(0))
      .toNumber();
  }, [smallTokens]);

  React.useEffect(() => {
    if (result) {
      const smallToken = {
        ...SMALL_TOKEN,
        symbol: `${smallTokens?.length} low value tokens`,
        _usdValue: smallTokensTotalValue,
        _usdValueStr: formatNetworth(smallTokensTotalValue),
      };
      const newResult = [...result];
      if (smallTokens && smallTokens.length > 0) {
        newResult.push(smallToken);
      }
      setMainTokens(newResult);
    }
  }, [result, smallTokens, smallTokensTotalValue]);

  return {
    mainTokens,
    smallTokens,
  };
};
