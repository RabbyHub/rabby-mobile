import { useEffect, useRef, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { appendByTokenKey, toMemeMarketItem } from './market';
import { fetchMemeTokenList } from './memeApi';
import type { MemeMarketItem } from './types';

const SEARCH_DEBOUNCE_MS = 300;

type SearchResult = {
  symbol: string;
  items: MemeMarketItem[];
  page: number;
  hasMore: boolean;
};

const EMPTY_ITEMS: MemeMarketItem[] = [];
const INITIAL_RESULT: SearchResult = {
  symbol: '',
  items: EMPTY_ITEMS,
  page: 0,
  hasMore: false,
};

export const useMemeSearch = (keyword: string, enabled: boolean) => {
  const symbol = enabled ? keyword.trim() : '';
  const [result, setResult] = useState<SearchResult>(INITIAL_RESULT);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    loadingMoreRef.current = false;
    if (!symbol) {
      // leaving search: the next search must not start from these results
      setResult(INITIAL_RESULT);
      return;
    }
    const timer = setTimeout(() => {
      fetchMemeTokenList({ symbol, page: 1 })
        .then(res => {
          if (requestId === requestIdRef.current) {
            setResult({
              symbol,
              items: res.tokens.map(toMemeMarketItem),
              page: res.page,
              hasMore: res.has_more,
            });
          }
        })
        .catch(() => {
          if (requestId === requestIdRef.current) {
            setResult({ ...INITIAL_RESULT, symbol, page: 1 });
          }
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [symbol]);

  // A result only counts for the keyword it was fetched with.
  const current = symbol && result.symbol === symbol ? result : null;

  const loadMore = useMemoizedFn(() => {
    if (!current || !current.hasMore || loadingMoreRef.current) {
      return;
    }
    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    fetchMemeTokenList({ symbol: current.symbol, page: current.page + 1 })
      .then(res => {
        if (requestId === requestIdRef.current) {
          setResult(prev =>
            prev.symbol === current.symbol
              ? {
                  ...prev,
                  items: appendByTokenKey(
                    prev.items,
                    res.tokens.map(toMemeMarketItem),
                  ),
                  page: res.page,
                  hasMore: res.has_more,
                }
              : prev,
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (requestId === requestIdRef.current) {
          loadingMoreRef.current = false;
        }
      });
  });

  // While the next keyword is debounced / loading, keep showing the previous results.
  const shown = symbol && result.symbol ? result : null;

  return {
    items: shown ? shown.items : EMPTY_ITEMS,
    hasMore: current ? current.hasMore : false,
    loading: !!symbol && !shown,
    loadMore,
  };
};
