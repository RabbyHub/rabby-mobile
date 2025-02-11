import { useCallback, useEffect, useLayoutEffect } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';

export const useQueryProjects = (userAddr: string | undefined) => {
  const {
    tokens,
    updateData: updateTokens,
    isLoading,
  } = useTokens(userAddr, false, 0, undefined);

  const {
    data: portfolios,
    hasValue: hasPortfolios,
    updateData: updatePortfolio,
  } = usePortfolios(userAddr, false);

  const { list: nftList, reload: reloadNftList } = useQueryNft(userAddr, false);

  const refreshPositions = useCallback(
    async (force?: boolean) => {
      try {
        await Promise.all([
          updateTokens(force),
          updatePortfolio(force),
          reloadNftList(force),
        ]);
      } catch (error) {
        console.error(error);
      }
    },
    [updatePortfolio, updateTokens, reloadNftList],
  );

  useLayoutEffect(() => {
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
    updateTokens,
    updatePortfolio,
    reloadNftList,
    loading: isLoading,
    refreshing: !!isLoading,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
