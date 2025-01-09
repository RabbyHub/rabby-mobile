import { useCallback, useEffect, useMemo } from 'react';
import { useTokens } from './token';
import { usePortfolios } from './usePortfolio';
import { useQueryNft } from './nft';
import { useLastUpdateTimeAtom } from './store';
import { useSafeState } from '@/hooks/useSafeState';

export const useQueryProjects = (
  userAddr: string | undefined,
  isTestnet = false,
) => {
  const [lastUpdateTime, setLastUpdateTime] = useLastUpdateTimeAtom(userAddr);
  const [isLoading, setLoading] = useSafeState(false);

  const shouldUseHistory = useMemo(() => {
    return lastUpdateTime && Date.now() - lastUpdateTime < 10 * 60 * 1000;
  }, [lastUpdateTime]);

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
        setLastUpdateTime(Date.now());
      }
    }
  }, [
    isLoading,
    setLoading,
    updatePortfolio,
    updateTokens,
    reloadNftList,
    setLastUpdateTime,
  ]);

  useEffect(() => {
    if (!shouldUseHistory && userAddr) {
      refreshPositions();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldUseHistory, userAddr]);

  return {
    refreshPositions,
    hasPortfolios,
    tokens,
    portfolios,
    nftList,
    loading: isLoading,
    refreshing: !!isLoading && !!lastUpdateTime,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
  };
};
