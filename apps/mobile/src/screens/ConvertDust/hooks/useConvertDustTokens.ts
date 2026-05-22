import { useRequest } from 'ahooks';
import { useEffect, useMemo } from 'react';

import { openapi } from '@/core/request';
import useTokenList, {
  getSingleAssetsCacheKey,
  ITokenItem,
  TokenEntityId,
  tokenEntityResourceStore,
  useTokenListComputedStore,
} from '@/store/tokens';
import type { DustFilter } from '../constant';
import { useShallow } from 'zustand/shallow';
import { findChain, makeTokenFromChain } from '@/utils/chain';

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
      unFoldTokenIds: [] as TokenEntityId[],
      foldTokenIds: [] as TokenEntityId[],
      scamTokenIds: [] as TokenEntityId[],
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

  const { unFoldTokenIds, foldTokenIds, scamTokenIds } =
    useTokenListComputedStore(
      useShallow(state =>
        singleAssetsKey
          ? state.singleAssetsIndexCache[singleAssetsKey] || emptyResult
          : emptyResult,
      ),
    );

  const tokens = useMemo(() => {
    return [...unFoldTokenIds, ...foldTokenIds, ...scamTokenIds]
      .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
      .filter((token): token is ITokenItem => !!token);
  }, [foldTokenIds, scamTokenIds, unFoldTokenIds]);

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
  const chainInfo = useMemo(
    () =>
      findChain({
        serverId: chainServerId,
      }),
    [chainServerId],
  );
  const fallbackReceiveToken = useMemo(
    () => (chainInfo ? makeTokenFromChain(chainInfo) : null),
    [chainInfo],
  );
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

  return data ?? fallbackReceiveToken;
}
