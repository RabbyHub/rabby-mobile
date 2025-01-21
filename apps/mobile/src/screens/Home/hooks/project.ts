import { useCallback, useEffect } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';
import { useSafeState } from '@/hooks/useSafeState';

export const useQueryProjects = (userAddr: string | undefined) => {
  const [isLoading, setLoading] = useSafeState(false);

  const {
    tokens,
    updateData: updateTokens,
    refreshTagToken,
  } = useTokens(userAddr, false, 0, undefined);

  const {
    data: portfolios,
    hasValue: hasPortfolios,
    updateData: updatePortfolio,
    refreshTagPortfolio,
  } = usePortfolios(userAddr, false);

  const {
    list: nftList,
    reload: reloadNftList,
    refreshTagNft,
  } = useQueryNft(userAddr, false);

  const refreshPositions = useCallback(
    async (force?: boolean) => {
      if (!isLoading) {
        setLoading(true);
        try {
          await Promise.all([
            updateTokens(force),
            updatePortfolio(force),
            reloadNftList(force),
          ]);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }
    },
    [isLoading, setLoading, updatePortfolio, updateTokens, reloadNftList],
  );

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
    refreshTagNft,
    refreshTagToken,
    refreshTagPortfolio,
  };
};
