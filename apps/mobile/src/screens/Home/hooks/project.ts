import { useCallback, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { useIsFocused } from '@react-navigation/native';

import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useSafeState } from '@/hooks/useSafeState';

const Cache_Timeout = 5 * 60;

export const useQueryProjects = (userAddr: string, withHistory = false) => {
  const isFocused = useIsFocused();
  const [time, setTime] = useSafeState(dayjs().subtract(1, 'day'));

  useEffect(() => {
    if (
      isFocused &&
      time!.add(1, 'day').add(Cache_Timeout, 's').isBefore(dayjs())
    ) {
      refreshPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, time]);

  const historyTime = useMemo(
    () => (withHistory ? time : undefined),
    [withHistory, time],
  );

  const {
    tokens,
    netWorth: tokenNetWorth,
    isLoading: isTokensLoading,
    hasValue: hasTokens,
    updateData: updateTokens,
    walletProject,
  } = useTokens(userAddr, historyTime);

  const {
    data: portfolios,
    isLoading: isPortfoliosLoading,
    hasValue: hasPortfolios,
    netWorth: portfolioNetWorth,
    updateData: updatePortfolio,
  } = usePortfolios(userAddr, historyTime);

  const refreshPositions = useCallback(() => {
    if (!isTokensLoading && !isPortfoliosLoading) {
      updatePortfolio();
      updateTokens();
      setTime(dayjs().subtract(1, 'day'));
    }
  }, [
    updatePortfolio,
    updateTokens,
    isTokensLoading,
    isPortfoliosLoading,
    setTime,
  ]);

  const grossNetWorth = useMemo(
    () => tokenNetWorth + portfolioNetWorth!,
    [tokenNetWorth, portfolioNetWorth],
  );

  return {
    tokenNetWorth,
    portfolioNetWorth,
    grossNetWorth,
    refreshPositions,
    isTokensLoading,
    isPortfoliosLoading,
    hasTokens,
    hasPortfolios,
    tokens,
    portfolios,
    walletProject,
  };
};
