import { IManageToken } from '@/core/services/preference';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { preferenceService } from '@/core/services';
import { openapi } from '@/core/request';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

const chunkArray = (arr: IManageToken[], size: number): IManageToken[][] => {
  const chunks: IManageToken[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// export const watchlistTokensAtom = atom<TokenDetailWithPriceCurve[]>([]);
const watchlistTokensState = zCreate<{
  data: TokenDetailWithPriceCurve[];
  hasData: boolean;
  loading: boolean;
}>(() => {
  return {
    data: [],
    hasData: false,
    loading: false,
  };
});
function setData(data: UpdaterOrPartials<TokenDetailWithPriceCurve[]>) {
  watchlistTokensState.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev.data, data, {
      strict: true,
    });
    if (!changed) {
      return prev;
    }
    return {
      ...prev,
      data: newVal,
    };
  });
}

const cacheRef = { current: new Map<string, TokenDetailWithPriceCurve>() };
const getWatchlistTokens = async (force = false) => {
  try {
    const data = watchlistTokensState.getState().data;
    if (data.length === 0) {
      // setLoading(true);
      watchlistTokensState.setState(prev => ({
        ...prev,
        loading: true,
      }));
    }
    const { pinedQueue = [] } = await preferenceService.getUserTokenSettings();
    watchlistTokensState.setState(prev => ({
      ...prev,
      hasData: pinedQueue.length > 0,
    }));
    // 生成所有token的key
    const allKeys = pinedQueue
      .filter(t => t.chainId && t.tokenId)
      .map(i => `${i.chainId}:${i.tokenId}`);
    let needFetchKeys = allKeys;
    if (!force) {
      needFetchKeys = allKeys.filter(key => !cacheRef.current.has(key));
    }
    // 分批请求未缓存的token
    let newTokenDetails: TokenDetailWithPriceCurve[] = [];
    const batches = chunkArray(
      pinedQueue.filter(t =>
        needFetchKeys.includes(`${t.chainId}:${t.tokenId}`),
      ),
      50,
    );
    for (const batch of batches) {
      const batchKeys = batch.map(i => `${i.chainId}:${i.tokenId}`);
      if (batchKeys.length === 0) {
        continue;
      }
      const batchDetails = await openapi.getTokensDetailByUuids(batchKeys);
      // 更新缓存
      batchDetails.forEach(token => {
        const key = `${token.chain}:${token.id}`;
        cacheRef.current.set(key, token);
      });
      newTokenDetails = [...newTokenDetails, ...batchDetails];
    }
    // force时，清理缓存并重新填充
    if (force) {
      cacheRef.current.clear();
      newTokenDetails.forEach(token => {
        const key = `${token.chain}:${token.id}`;
        cacheRef.current.set(key, token);
      });
    }
    // 返回顺序与pinedQueue一致的完整token列表
    const result = allKeys
      .map(key => cacheRef.current.get(key))
      .filter(Boolean) as TokenDetailWithPriceCurve[];
    watchlistTokensState.setState(prev => ({
      ...prev,
      loading: false,
    }));
    return result;
  } catch (error) {
    console.error('getWatchlistTokens error', error);
    watchlistTokensState.setState(prev => ({
      ...prev,
      loading: false,
    }));
    return [];
  }
};

export const useWatchlistTokens = () => {
  const data = watchlistTokensState(s => s.data);
  const hasData = watchlistTokensState(s => s.hasData);
  const loading = watchlistTokensState(s => s.loading);

  const handleFetchTokens = useCallback((force = false) => {
    return getWatchlistTokens(force).then(setData);
  }, []);

  return {
    data,
    handleFetchTokens,
    hasData,
    loading,
  };
};

export const useWatchListTokenBadge = () => {
  const { handleFetchTokens, data } = useWatchlistTokens();

  const last3Token = useMemo(
    () => (data.length >= 3 ? data.slice(0, 3) : data),
    [data],
  );

  useEffect(() => {
    handleFetchTokens();
  }, [handleFetchTokens]);

  return last3Token;
};
