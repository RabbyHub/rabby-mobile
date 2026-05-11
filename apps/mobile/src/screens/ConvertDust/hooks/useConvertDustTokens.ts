import { useRequest } from 'ahooks';
import { useEffect, useMemo } from 'react';

import { openapi } from '@/core/request';
import useTokenList, {
  getSingleAssetsCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';
import type { DustFilter } from '../constant';
import { useShallow } from 'zustand/shallow';

export function useConvertDustTokenList({
  address,
  chainServerId,
  receiveTokenId,
  selectedFilter,
}: {
  address?: string;
  chainServerId?: string;
  receiveTokenId?: string;
  selectedFilter: DustFilter;
}) {
  const lowerAddress = address?.toLowerCase();

  const emptyResult = useMemo(
    () => ({
      unFoldTokens: [] as ITokenItem[],
      foldTokens: [] as ITokenItem[],
      scamTokens: [] as ITokenItem[],
      hasFoldTokens: false,
    }),
    [],
  );

  const registerSingleAssets = useTokenListComputedStore(
    state => state.registerSingleAssets,
  );

  const singleAssetsKey = useMemo(() => {
    if (!address) {
      return null;
    }
    return getSingleAssetsCacheKey(address, chainServerId, false);
  }, [address, chainServerId]);

  useEffect(() => {
    if (!address) {
      return;
    }
    registerSingleAssets(address, chainServerId, false);
  }, [address, chainServerId, registerSingleAssets]);

  const { unFoldTokens, foldTokens, scamTokens } = useTokenListComputedStore(
    useShallow(state =>
      singleAssetsKey
        ? state.singleAssetsCache[singleAssetsKey] || emptyResult
        : emptyResult,
    ),
  );

  const isLoading = useTokenList(state => {
    if (!lowerAddress) {
      return false;
    }
    return !!state.isLoadingByAddress[lowerAddress]?.allLoading;
  });
  const getTokenList = useTokenList(s => s.getTokenList);

  useEffect(() => {
    if (!address) {
      return;
    }
    getTokenList(address);
  }, [address, getTokenList]);

  const tokens = useMemo(() => {
    return [...unFoldTokens, ...foldTokens, ...scamTokens];
  }, [unFoldTokens, foldTokens, scamTokens]);

  const threshold = selectedFilter.value;

  const dustTokens = useMemo(
    () =>
      tokens.filter(token => {
        const usdValue = token.usd_value || token.price * token.amount || 0;
        return token.id !== receiveTokenId && usdValue < threshold;
      }),
    [receiveTokenId, threshold, tokens],
  );

  return {
    getTokenList,
    tokens: dustTokens,
    isLoading,
  };
}

export function useConvertDustReceiveToken({
  address,
  chainServerId,
  nativeTokenAddress,
}: {
  address?: string;
  chainServerId?: string;
  nativeTokenAddress?: string;
}) {
  const { data } = useRequest(
    async () => {
      if (!address || !chainServerId || !nativeTokenAddress) {
        return null;
      }

      try {
        return await openapi.getToken(
          address,
          chainServerId,
          nativeTokenAddress,
        );
      } catch {
        return null;
      }
    },
    {
      refreshDeps: [address, chainServerId, nativeTokenAddress],
      cacheKey: `useConvertDustReceiveToken-${address}-${chainServerId}-${nativeTokenAddress}`,
      staleTime: 10 * 1000,
    },
  );

  return data ?? null;
}
