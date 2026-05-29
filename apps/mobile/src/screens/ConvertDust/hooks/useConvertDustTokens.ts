import { useRequest } from 'ahooks';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';

import { zCreate, zMutative } from '@/core/utils/reexports';
import { openapi } from '@/core/request';
import useTokenList, {
  buildSingleAssetsIndexFromTokenIds,
  EMPTY_TOKEN_ENTITY_IDS,
  ITokenItem,
  TokenEntityId,
  tokenEntityResourceStore,
  useTokenIndexStore,
} from '@/store/tokens';
import type { DustFilter } from '../constant';
import { findChain, makeTokenFromChain } from '@/utils/chain';

const EMPTY_CONVERT_DUST_TOKEN_IDS: TokenEntityId[] = [];

const getConvertDustTokenListKey = ({
  address,
  chainServerId,
  receiveTokenId,
  threshold,
}: {
  address: string;
  chainServerId?: string;
  receiveTokenId?: string;
  threshold: number;
}) =>
  `${address.toLowerCase()}::${chainServerId ?? ''}::${
    receiveTokenId ?? ''
  }::${threshold}`;

const buildStableTokenIds = (
  tokenIds: TokenEntityId[],
  previousTokenIds?: TokenEntityId[],
) => {
  if (!tokenIds.length) {
    return previousTokenIds?.length
      ? EMPTY_CONVERT_DUST_TOKEN_IDS
      : previousTokenIds || EMPTY_CONVERT_DUST_TOKEN_IDS;
  }

  const canReusePrevious = previousTokenIds?.length === tokenIds.length;
  let nextTokenIds: TokenEntityId[] | undefined = canReusePrevious
    ? undefined
    : [];

  tokenIds.forEach((tokenId, index) => {
    if (canReusePrevious && !nextTokenIds) {
      if (previousTokenIds![index] === tokenId) {
        return;
      }
      nextTokenIds = previousTokenIds!.slice(0, index);
    }
    nextTokenIds!.push(tokenId);
  });

  return nextTokenIds || previousTokenIds!;
};

const buildConvertDustTokenIds = ({
  tokenIds,
  chainServerId,
  receiveTokenId,
  threshold,
  previousTokenIds,
}: {
  tokenIds: TokenEntityId[];
  chainServerId?: string;
  receiveTokenId?: string;
  threshold: number;
  previousTokenIds?: TokenEntityId[];
}) => {
  const assetsIndex = buildSingleAssetsIndexFromTokenIds(
    tokenIds,
    chainServerId,
    false,
  );
  const dustTokenIds = [
    ...assetsIndex.unFoldTokenIds,
    ...assetsIndex.foldTokenIds,
    ...assetsIndex.scamTokenIds,
  ].filter(tokenId => {
    const token = tokenEntityResourceStore.getValue(tokenId);
    if (!token) {
      return false;
    }

    const usdValue = token.usd_value || token.price * token.amount || 0;
    return token.id !== receiveTokenId && usdValue < threshold;
  });

  return buildStableTokenIds(dustTokenIds, previousTokenIds);
};

type ConvertDustTokenIndexState = {
  dustTokenIdsByKey: Record<string, TokenEntityId[]>;
  syncDustTokenIds(params: {
    key: string;
    tokenIds: TokenEntityId[];
    chainServerId?: string;
    receiveTokenId?: string;
    threshold: number;
  }): void;
};

const useConvertDustTokenIndexStore = zCreate(
  zMutative<ConvertDustTokenIndexState>((set, get) => ({
    dustTokenIdsByKey: {},
    syncDustTokenIds({
      key,
      tokenIds,
      chainServerId,
      receiveTokenId,
      threshold,
    }) {
      const previousTokenIds = get().dustTokenIdsByKey[key];
      const nextTokenIds = buildConvertDustTokenIds({
        tokenIds,
        chainServerId,
        receiveTokenId,
        threshold,
        previousTokenIds,
      });

      if (previousTokenIds === nextTokenIds) {
        return;
      }

      set(draft => {
        draft.dustTokenIdsByKey[key] = nextTokenIds;
      });
    },
  })),
);

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
  const threshold = selectedFilter.value;
  const dustTokenListKey = useMemo(() => {
    if (!lowerAddress) {
      return null;
    }
    return getConvertDustTokenListKey({
      address: lowerAddress,
      chainServerId,
      receiveTokenId,
      threshold,
    });
  }, [chainServerId, lowerAddress, receiveTokenId, threshold]);

  useEffect(() => {
    if (!address) {
      return;
    }
    useTokenIndexStore
      .getState()
      .syncFromTokenListMap(useTokenList.getState().tokenListMap, [address]);
  }, [address]);

  const tokenIds = useTokenIndexStore(
    useShallow(state => {
      if (!lowerAddress) {
        return EMPTY_TOKEN_ENTITY_IDS;
      }
      return state.addressTokenIds[lowerAddress] || EMPTY_TOKEN_ENTITY_IDS;
    }),
  );
  const tokenVersions = tokenEntityResourceStore.useStore(
    useShallow(state =>
      tokenIds.map(tokenId => state.metaMap[tokenId]?.version || 0),
    ),
  );

  useEffect(() => {
    if (!dustTokenListKey) {
      return;
    }
    useConvertDustTokenIndexStore.getState().syncDustTokenIds({
      key: dustTokenListKey,
      tokenIds,
      chainServerId,
      receiveTokenId,
      threshold,
    });
  }, [
    chainServerId,
    dustTokenListKey,
    receiveTokenId,
    threshold,
    tokenIds,
    tokenVersions,
  ]);

  const dustTokenIds = useConvertDustTokenIndexStore(
    useShallow(state =>
      dustTokenListKey
        ? state.dustTokenIdsByKey[dustTokenListKey] ||
          EMPTY_CONVERT_DUST_TOKEN_IDS
        : EMPTY_CONVERT_DUST_TOKEN_IDS,
    ),
  );

  const tokens = useMemo(
    () =>
      dustTokenIds
        .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
        .filter((token): token is ITokenItem => !!token),
    [dustTokenIds],
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

  return {
    getTokenList,
    tokens,
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
