import { IManageToken } from '@/core/services/preference';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { preferenceService } from '@/core/services';
import { openapi } from '@/core/request';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  sortWatchlistTokens,
  watchlistChangeSortAtom,
  watchlistTokenSortAtom,
} from '../sort';
import { getWatchlistTopCache } from '../cache';

const chunkArray = (arr: IManageToken[], size: number): IManageToken[][] => {
  const chunks: IManageToken[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const watchlistTokensAtom = atom<TokenDetailWithPriceCurve[]>(
  getWatchlistTopCache(),
);

export const useWatchlistTokens = (onBeforeRefresh?: () => void) => {
  const [data, setData] = useAtom(watchlistTokensAtom);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(false);
  // token级别缓存，key为chainId:tokenId
  const cacheRef = useRef<Map<string, TokenDetailWithPriceCurve>>(new Map());
  const noData = useMemo(() => data.length === 0, [data]);

  const getWatchlistTokens = useCallback(
    async (force = false, chainId?: string) => {
      try {
        if (noData) {
          setLoading(true);
        }
        const { pinedQueue = [] } =
          await preferenceService.getUserTokenSettings();
        setHasData(pinedQueue.length > 0);
        // 生成所有token的key
        const allKeys = pinedQueue
          .filter(t =>
            chainId ? t.chainId.toLowerCase() === chainId.toLowerCase() : true,
          )
          .filter(t => t.chainId && t.tokenId)
          .map(i => `${i.chainId}:${i.tokenId}`);
        let needFetchKeys = allKeys;
        if (!force) {
          needFetchKeys = allKeys.filter(key => !cacheRef.current.has(key));
        }
        if (force || needFetchKeys.length > 0) {
          onBeforeRefresh?.();
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
        setLoading(false);
        return result;
      } catch (error) {
        console.error('getWatchlistTokens error', error);
        setLoading(false);
        return [];
      }
    },
    [noData, onBeforeRefresh],
  );

  const handleFetchTokens = useCallback(
    (force = false, chainId?: string) => {
      return getWatchlistTokens(force, chainId).then(setData);
    },
    [getWatchlistTokens, setData],
  );

  return {
    data,
    handleFetchTokens,
    hasData,
    loading,
  };
};

export const useWatchListTokenBadge = () => {
  const { handleFetchTokens, data } = useWatchlistTokens();
  const tokenSort = useAtomValue(watchlistTokenSortAtom);
  const changeSort = useAtomValue(watchlistChangeSortAtom);
  const sortedTokens = useMemo(
    () => sortWatchlistTokens(data, tokenSort, changeSort),
    [changeSort, data, tokenSort],
  );

  const last3Token = useMemo(
    () => (sortedTokens.length >= 3 ? sortedTokens.slice(0, 3) : sortedTokens),
    [sortedTokens],
  );

  useEffect(() => {
    handleFetchTokens();
  }, [handleFetchTokens]);

  return last3Token;
};
