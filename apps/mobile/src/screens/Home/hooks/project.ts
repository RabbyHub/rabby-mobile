import { useCallback, useEffect, useMemo } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';
import { useLastUpdateTimeAtom } from './store';

export const useQueryProjects = (
  userAddr: string | undefined,
  isTestnet = false,
) => {
  const [lastUpdateTime, setLastUpdateTime] = useLastUpdateTimeAtom(userAddr);

  const shouldUseHistory = useMemo(() => {
    return lastUpdateTime && Date.now() - lastUpdateTime < 10 * 60 * 1000;
  }, [lastUpdateTime]);

  const {
    tokens,
    isLoading: isTokensLoading,
    updateData: updateTokens,
  } = useTokens(userAddr, false, 0, undefined, isTestnet);

  const {
    data: portfolios,
    isLoading: isPortfoliosLoading,
    hasValue: hasPortfolios,
    updateData: updatePortfolio,
  } = usePortfolios(userAddr, false, isTestnet);

  const {
    list: nftList,
    isLoading: nftListLoading,
    reload: reloadNftList,
  } = useQueryNft(userAddr, false);

  const loading = isTokensLoading || isPortfoliosLoading || nftListLoading;

  const refreshPositions = useCallback(async () => {
    if (!isTokensLoading && !isPortfoliosLoading && !nftListLoading) {
      console.log('🔍 CUSTOM_LOGGER:=>: force==refreshPositions)');
      await updatePortfolio();
      await updateTokens();
      await reloadNftList();
      setLastUpdateTime(Date.now());
    }
  }, [
    isTokensLoading,
    isPortfoliosLoading,
    nftListLoading,
    updatePortfolio,
    updateTokens,
    reloadNftList,
    setLastUpdateTime,
  ]);

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

  useEffect(() => {
    if (!shouldUseHistory && userAddr) {
      console.log('🔍 CUSTOM_LOGGER:=>: this cache is failed');
      refreshPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldUseHistory, userAddr]);

  return {
    refreshPositions,
    isTokensLoading,
    isPortfoliosLoading,
    hasPortfolios,
    tokens,
    portfolios,
    nftList,
    nftListLoading,
    loading,
    refreshing: refreshingToken || refreshingDefi || refreshingNft,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
