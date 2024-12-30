import { useCallback, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useSafeState } from '@/hooks/useSafeState';
import { useQueryNft } from './nft';

const Cache_Timeout = 5 * 60;

export const useQueryProjects = (
  userAddr: string | undefined,
  withHistory = false,
  visible: boolean,
  isTestnet = false,
) => {
  const [time, setTime] = useSafeState(dayjs().subtract(1, 'day'));

  useEffect(() => {
    if (time!.add(1, 'day').add(Cache_Timeout, 's').isBefore(dayjs())) {
      // refreshPositions();
    }
  }, [time]);

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
    // testnetTokens,
  } = useTokens(userAddr, historyTime, visible, 0, undefined, isTestnet);

  const {
    data: portfolios,
    isLoading: isPortfoliosLoading,
    hasValue: hasPortfolios,
    netWorth: portfolioNetWorth,
    updateData: updatePortfolio,
  } = usePortfolios(userAddr, historyTime, visible, isTestnet);

  const {
    list: nftList,
    isLoading: nftListLoading,
    reload: reloadNftList,
  } = useQueryNft(userAddr);

  const refreshPositions = useCallback(() => {
    if (!isTokensLoading && !isPortfoliosLoading) {
      updatePortfolio();
      updateTokens();
      reloadNftList();
      setTime(dayjs().subtract(1, 'day'));
    }
  }, [
    isTokensLoading,
    isPortfoliosLoading,
    updatePortfolio,
    updateTokens,
    reloadNftList,
    setTime,
  ]);

  const grossNetWorth = useMemo(
    () => tokenNetWorth + portfolioNetWorth!,
    [tokenNetWorth, portfolioNetWorth],
  );

  const refreshingToken = useMemo(() => {
    if ((tokens?.length || 0) > 0) {
      return !!isTokensLoading;
    } else {
      return false;
    }
  }, [isTokensLoading, tokens?.length]);
  const refreshingDefi = useMemo(() => {
    if ((portfolios?.length || 0) > 0) {
      return !!isPortfoliosLoading;
    } else {
      return false;
    }
  }, [portfolios?.length, isPortfoliosLoading]);

  const refreshingNft = useMemo(() => {
    if ((nftList?.length || 0) > 0) {
      return !!nftListLoading;
    } else {
      return false;
    }
  }, [nftList?.length, nftListLoading]);

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
    nftList,
    nftListLoading,
    reloadNftList,
    loading: isTokensLoading || isPortfoliosLoading || nftListLoading,
    refreshing: refreshingToken || refreshingDefi || refreshingNft,
    hasAssets: !!tokens.length || !!portfolios?.length || !!nftList.length,
  };
};
