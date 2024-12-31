import { useCallback, useMemo } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';

export const useQueryProjects = (
  userAddr: string | undefined,
  visible: boolean,
  isTestnet = false,
) => {
  const {
    tokens,
    isLoading: isTokensLoading,
    updateData: updateTokens,
  } = useTokens(userAddr, visible, 0, undefined, isTestnet);

  const {
    data: portfolios,
    isLoading: isPortfoliosLoading,
    hasValue: hasPortfolios,
    updateData: updatePortfolio,
  } = usePortfolios(userAddr, visible, isTestnet);

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
    }
  }, [
    isTokensLoading,
    isPortfoliosLoading,
    updatePortfolio,
    updateTokens,
    reloadNftList,
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

  return {
    refreshPositions,
    isTokensLoading,
    isPortfoliosLoading,
    hasPortfolios,
    tokens,
    portfolios,
    nftList,
    nftListLoading,
    loading: isTokensLoading || isPortfoliosLoading || nftListLoading,
    refreshing: refreshingToken || refreshingDefi || refreshingNft,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
