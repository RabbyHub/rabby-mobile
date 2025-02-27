import { useCallback, useLayoutEffect, useState } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';

export const useQueryProjects = (userAddr: string | undefined) => {
  const [refreshing, setRefreshing] = useState(false);
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
        if (force) {
          setRefreshing(true);
        }
        await updateTokens(force);
        await Promise.all([updatePortfolio(force), reloadNftList(force)]);
      } catch (error) {
        console.error(error);
      } finally {
        setRefreshing(false);
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
    loadingToken: isLoading,
    refreshing: refreshing,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
