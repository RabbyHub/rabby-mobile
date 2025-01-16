import { useCallback, useEffect } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';
import { useSafeState } from '@/hooks/useSafeState';

export const useQueryProjects = (
  userAddr: string | undefined,
  isTestnet = false,
) => {
  const [isLoading, setLoading] = useSafeState(false);

  const { tokens, updateData: updateTokens } = useTokens(
    userAddr,
    false,
    0,
    undefined,
    isTestnet,
  );

  const {
    data: portfolios,
    hasValue: hasPortfolios,
    updateData: updatePortfolio,
  } = usePortfolios(userAddr, false, isTestnet);

  const { list: nftList, reload: reloadNftList } = useQueryNft(userAddr, false);

  const refreshPositions = useCallback(async () => {
    if (!isLoading) {
      setLoading(true);
      try {
        await Promise.all([updatePortfolio(), updateTokens(), reloadNftList()]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  }, [isLoading, setLoading, updatePortfolio, updateTokens, reloadNftList]);

  useEffect(() => {
    if (userAddr) {
      refreshPositions();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddr]);

  return {
    refreshPositions,
    hasPortfolios,
    tokens,
    portfolios,
    nftList,
    loading: isLoading,
    refreshing: !!isLoading,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
