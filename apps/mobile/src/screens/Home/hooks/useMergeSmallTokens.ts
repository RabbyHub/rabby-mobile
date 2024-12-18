import { useExpandList } from '@/hooks/useExpandList';
import BigNumber from 'bignumber.js';
import React from 'react';
import { AbstractPortfolioToken } from '../types';

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

  React.useEffect(() => {
    if (result) {
      const newResult = [...result];
      setMainTokens(newResult);
    }
  }, [result]);

  return {
    mainTokens,
  };
};
