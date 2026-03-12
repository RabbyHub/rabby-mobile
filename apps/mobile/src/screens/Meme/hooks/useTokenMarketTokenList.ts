import { openapi } from '@/core/request';
import { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

type SortOrder = 'desc' | 'asc';

export const useTokenMarketTokenList = (
  categoryId: string,
  orderBy?: string,
  order?: SortOrder,
) => {
  const [tokenList, setTokenList] = useState<TokenMarketTokenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const nextCursorRef = useRef<string | undefined>(undefined);
  const currentOrderByRef = useRef<string | undefined>(orderBy);
  const currentOrderRef = useRef<SortOrder | undefined>(order);
  const loadingMoreLockRef = useRef(false);

  const getTokenList = useCallback(
    async (
      sortOrderBy?: string,
      sortOrder?: SortOrder,
      append = false,
      silent = false,
    ) => {
      try {
        const orderChanged =
          currentOrderByRef.current !== sortOrderBy ||
          currentOrderRef.current !== sortOrder;

        if (orderChanged && !append) {
          nextCursorRef.current = undefined;
          setHasMore(true);
        }

        if (!silent) {
          if (append) {
            if (loadingMoreLockRef.current) {
              return;
            }
            loadingMoreLockRef.current = true;
            setLoadingMore(true);
          } else {
            setLoading(true);
          }
        }

        const res = await openapi.getTokenMarketTokenList({
          category_id: categoryId,
          order_by: sortOrderBy,
          order: sortOrder,
          limit: 100,
          cursor: append ? nextCursorRef.current || '' : '',
        });
        console.log('CUSTOM_LOGGER:=>: res', res.data_list.length);

        const pagination = res.pagination || {};
        const nextCursor = pagination.next_cursor;
        const hasNext = pagination.has_next ?? false;

        setTokenList(prev =>
          append
            ? uniqBy([...prev, ...res.data_list], item => item.id)
            : res.data_list,
        );

        nextCursorRef.current = nextCursor;
        setHasMore(hasNext);
        currentOrderByRef.current = sortOrderBy;
        currentOrderRef.current = sortOrder;

        if (!silent) {
          if (append) {
            loadingMoreLockRef.current = false;
            setLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('getTokenMarketTokenList error', error);
        if (!silent) {
          if (append) {
            loadingMoreLockRef.current = false;
            setLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
        return [];
      }
    },
    [categoryId],
  );

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      getTokenList(currentOrderByRef.current, currentOrderRef.current, true);
    }
  }, [getTokenList, hasMore, loading, loadingMore]);

  const refreshTokenListSilently = useCallback(async () => {
    return getTokenList(
      currentOrderByRef.current || orderBy,
      currentOrderRef.current || order,
      false,
      true,
    );
  }, [getTokenList, order, orderBy]);

  useEffect(() => {
    if (!categoryId) {
      return;
    }
    getTokenList(orderBy, order);
  }, [categoryId, getTokenList, order, orderBy]);

  return {
    tokenList,
    getTokenList,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refreshTokenListSilently,
  };
};
