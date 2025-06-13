import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';
import BigNumber from 'bignumber.js';

export const useQueryProjects = (userAddr: string | undefined) => {
  const [refreshing, setRefreshing] = useState(false);
  const {
    tokens,
    updateData: updateTokens,
    isLoading: isTokenLoading,
  } = useTokens(userAddr, false, 0, undefined);

  const {
    data: portfolios,
    hasValue: hasPortfolios,
    updateData: updatePortfolio,
    isLoading: isPortfolioLoading,
  } = usePortfolios(userAddr, false);

  const {
    list: nftList,
    reload: reloadNftList,
    isLoading: isNftLoading,
  } = useQueryNft(userAddr, false);

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

  const chainsInfo = useMemo(() => {
    const chainAssets: Record<
      string,
      {
        total: BigNumber;
        percentage: BigNumber;
      }
    > = {};

    tokens?.forEach(token => {
      const chainId = token.chain;
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = {
          total: new BigNumber(0),
          percentage: new BigNumber(0),
        };
      }
      if (token._isExcludeBalance) {
        return;
      }
      chainAssets[chainId].total = chainAssets[chainId].total.plus(
        token._usdValue || 0,
      );
    });

    portfolios?.forEach(portfolio => {
      const chainId = portfolio.chain;
      if (!chainId) {
        return;
      }
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = {
          total: new BigNumber(0),
          percentage: new BigNumber(0),
        };
      }
      if (portfolio._isExcludeBalance) {
        return;
      }
      chainAssets[chainId].total = chainAssets[chainId].total.plus(
        portfolio.netWorth || 0,
      );
    });

    nftList?.forEach(nft => {
      const chainId = nft.chain;
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = {
          total: new BigNumber(0),
          percentage: new BigNumber(0),
        };
      }
    });

    const totalValue = Object.values(chainAssets).reduce(
      (sum, { total }) => sum.plus(total),
      new BigNumber(0),
    );

    if (totalValue.gt(0)) {
      Object.keys(chainAssets).forEach(chainId => {
        chainAssets[chainId].percentage =
          chainAssets[chainId].total.div(totalValue);
      });
    }
    const chainAssetsArray = Object.entries(chainAssets).map(
      ([chain, data]) => ({
        chain,
        total: data.total.toNumber(),
        percentage: data.percentage.multipliedBy(100).toNumber(),
      }),
    );

    chainAssetsArray.sort((a, b) => b.total - a.total);

    return {
      chainAssets: chainAssetsArray,
      chainLength: Object.keys(chainAssets).length,
    };
  }, [tokens, portfolios, nftList]);

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
    loadingToken: isTokenLoading,
    loadingPortfolio: isPortfolioLoading,
    loadingNft: isNftLoading,
    refreshing: refreshing,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
    chainsInfo,
  };
};
