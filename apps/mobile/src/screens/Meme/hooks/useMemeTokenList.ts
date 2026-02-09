import { openapi } from '@/core/request';
import { MemeItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

export const memeTokenListAtom = atom<MemeItem[]>([]);

type SortOrder = 'desc' | 'asc';
type OrderBy = 'volume_24h' | 'fdv' | 'price_change_24h';

export const useMemeTokenList = (orderBy?: OrderBy, order?: SortOrder) => {
  const [memeTokenList, setMemeTokenList] = useAtom(memeTokenListAtom);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const nextCursorRef = useRef<string | undefined>(undefined);
  const currentOrderByRef = useRef<OrderBy | undefined>(orderBy);
  const currentOrderRef = useRef<SortOrder | undefined>(order);
  const loadingMoreLockRef = useRef(false);

  const getMemeTokenList = useCallback(
    async (
      force = false,
      sortOrderBy?: OrderBy,
      sortOrder?: SortOrder,
      append = false,
    ) => {
      try {
        const finalOrderBy = sortOrderBy || orderBy || 'volume_24h';
        const finalOrder = sortOrder || order || 'desc';

        if (
          !force &&
          !append &&
          memeTokenList.length > 0 &&
          !sortOrderBy &&
          !sortOrder
        ) {
          return;
        }

        const orderChanged =
          currentOrderByRef.current !== finalOrderBy ||
          currentOrderRef.current !== finalOrder;

        if (orderChanged && !append) {
          nextCursorRef.current = undefined;
          setHasMore(true);
        }

        if (append) {
          // 防止 FlatList 的 onEndReached 在同一时刻触发多次导致重复请求
          if (loadingMoreLockRef.current) {
            return;
          }
          loadingMoreLockRef.current = true;
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const memeTokenListRes = await openapi.getMemeList({
          order_by: finalOrderBy,
          order: finalOrder,
          limit: 100,
          cursor: append ? nextCursorRef.current || '' : '',
        });

        const pagination = memeTokenListRes.pagination || {};
        const nextCursor = pagination.next_cursor;
        const hasNext = pagination.has_next ?? false;

        if (append) {
          const newList = uniqBy(
            [...memeTokenList, ...memeTokenListRes.data_list],
            item => item.id,
          );
          setMemeTokenList(newList);
        } else {
          setMemeTokenList(memeTokenListRes.data_list);
        }

        nextCursorRef.current = nextCursor;
        setHasMore(hasNext);
        currentOrderByRef.current = finalOrderBy;
        currentOrderRef.current = finalOrder;

        if (append) {
          loadingMoreLockRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('getMemeTokenList error', error);
        if (append) {
          loadingMoreLockRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
        return [];
      }
    },
    [orderBy, order, memeTokenList, setMemeTokenList],
  );

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      getMemeTokenList(false, undefined, undefined, true);
    }
  }, [loadingMore, hasMore, loading, getMemeTokenList]);

  /**
   * 首页自动轮询用：静默刷新第一页数据，不触发 loading/loadingMore
   * 当用户滚动位置在前100项时使用，用户不太会滑倒100项之后等刷新。
   */
  const refreshMemeTokenListSilently = useCallback(async () => {
    try {
      const finalOrderBy = currentOrderByRef.current || orderBy || 'volume_24h';
      const finalOrder = currentOrderRef.current || order || 'desc';

      const memeTokenListRes = await openapi.getMemeList({
        order_by: finalOrderBy,
        order: finalOrder,
        limit: 100,
        cursor: '',
      });

      const pagination = memeTokenListRes.pagination || {};
      const nextCursor = pagination.next_cursor;
      const hasNext = pagination.has_next ?? false;

      setMemeTokenList(memeTokenListRes.data_list);
      nextCursorRef.current = nextCursor;
      setHasMore(hasNext);
      currentOrderByRef.current = finalOrderBy;
      currentOrderRef.current = finalOrder;
    } catch (error) {
      console.error('refreshMemeTokenListSilently error', error);
    }
  }, [orderBy, order, setMemeTokenList]);

  useEffect(() => {
    getMemeTokenList(false, orderBy, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, orderBy]);

  return {
    memeTokenList,
    getMemeTokenList,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refreshMemeTokenListSilently,
  };
};
