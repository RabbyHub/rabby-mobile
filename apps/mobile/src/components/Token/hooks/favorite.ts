import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { openapi } from '@/core/request';
import type { IManageToken } from '@/core/startupServices/preference';
import type { ITokenItem } from '@/store/tokens';

import {
  createFavoriteTokenCache,
  EMPTY_FAVORITE_TOKENS,
  getScopedPinnedTokens,
  loadFavoriteTokenResource,
  makeFavoriteTokenResourceKey,
  normalizeFavoriteTokenPart,
} from './favoriteResource';
import { LatestAsyncRequest } from './useTokenListAsyncResource';

interface UseFavoriteTokensProps {
  focus?: boolean;
  address?: string;
  chainId?: string;
  pinnedTokens: readonly IManageToken[];
}

type FavoriteTokensStatus =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'ready'
  | 'error';

type FavoriteTokensState = {
  resourceKey: string;
  data: ITokenItem[];
  status: FavoriteTokensStatus;
};

export const useFavoriteTokens = ({
  focus,
  address,
  chainId,
  pinnedTokens,
}: UseFavoriteTokensProps) => {
  const ownerKey = normalizeFavoriteTokenPart(address);
  const scopedPinnedTokens = useMemo(
    () => getScopedPinnedTokens(pinnedTokens, chainId),
    [chainId, pinnedTokens],
  );
  const resourceKey = useMemo(
    () => makeFavoriteTokenResourceKey(address, scopedPinnedTokens),
    [address, scopedPinnedTokens],
  );

  const [state, setState] = useState<FavoriteTokensState>({
    resourceKey: '',
    data: EMPTY_FAVORITE_TOKENS,
    status: 'idle',
  });
  const cacheRef = useRef(createFavoriteTokenCache());
  const requestRef = useRef(new LatestAsyncRequest());

  const handleFetchTokens = useCallback(
    async (force = false) => {
      const requestId = requestRef.current.next();

      if (!address || !ownerKey) {
        setState({
          resourceKey,
          data: EMPTY_FAVORITE_TOKENS,
          status: 'ready',
        });
        return EMPTY_FAVORITE_TOKENS;
      }

      setState(previous => {
        if (previous.resourceKey === resourceKey && previous.data.length > 0) {
          return { ...previous, status: 'refreshing' };
        }
        return {
          resourceKey,
          data: EMPTY_FAVORITE_TOKENS,
          status: 'loading',
        };
      });

      try {
        const result = await loadFavoriteTokenResource({
          address,
          cache: cacheRef.current,
          force,
          pinnedTokens: scopedPinnedTokens,
          loadBatch: (keys, ownerAddress) =>
            openapi.customListToken(keys, ownerAddress),
        });

        if (requestRef.current.isCurrent(requestId)) {
          cacheRef.current = result.cache;
          setState({ resourceKey, data: result.data, status: 'ready' });
        }
        return result.data;
      } catch (error) {
        console.error('getFavoriteTokens error', error);
        if (requestRef.current.isCurrent(requestId)) {
          setState(previous => ({
            resourceKey,
            data:
              previous.resourceKey === resourceKey
                ? previous.data
                : EMPTY_FAVORITE_TOKENS,
            status: 'error',
          }));
        }
        return EMPTY_FAVORITE_TOKENS;
      }
    },
    [address, ownerKey, resourceKey, scopedPinnedTokens],
  );

  useEffect(() => {
    const request = requestRef.current;

    if (!focus) {
      request.invalidate();
      return;
    }

    handleFetchTokens();
    return () => {
      request.invalidate();
    };
  }, [focus, handleFetchTokens]);

  const isCurrentResource = state.resourceKey === resourceKey;
  const data = isCurrentResource ? state.data : EMPTY_FAVORITE_TOKENS;
  const filteredData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (a.is_core && !b.is_core) {
        return -1;
      }
      if (!a.is_core && b.is_core) {
        return 1;
      }
      const aValue = (a.price ?? 0) * (a.amount ?? 0);
      const bValue = (b.price ?? 0) * (b.amount ?? 0);
      return bValue - aValue;
    });
  }, [data]);

  return {
    data: filteredData,
    handleFetchTokens,
    hasData: scopedPinnedTokens.length > 0,
    loading:
      Boolean(focus) && (!isCurrentResource || state.status === 'loading'),
  };
};
