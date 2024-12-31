import { useCallback, useMemo } from 'react';
import { usePortfolios } from '@/screens/Home/hooks/usePortfolio';
import { useQueryNft } from '@/screens/Home/hooks/nft';
import { combinedTokensAtom } from '@/screens/Home/hooks/store';
import { useAtom } from 'jotai';

export const useQueryProjects = (
  userAddr: string | undefined,
  visible: boolean,
  isTestnet = false,
) => {
  const [tokens] = useAtom(combinedTokensAtom);

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
    if (!isPortfoliosLoading) {
      updatePortfolio();
      reloadNftList();
    }
  }, [isPortfoliosLoading, updatePortfolio, reloadNftList]);

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
    isPortfoliosLoading,
    hasPortfolios,
    tokens,
    portfolios,
    nftList,
    nftListLoading,
    loading: isPortfoliosLoading || nftListLoading,
    refreshing: refreshingDefi || refreshingNft,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
