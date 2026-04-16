import { useState, useMemo, useCallback } from 'react';

const INIT_PAGE_SIZE = 10;
const PAGE_SIZE = 10;
const useLoadMoreData = <T>(initList: T[]) => {
  const [displayCount, setDisplayCount] = useState(INIT_PAGE_SIZE);

  const displayList = useMemo(() => {
    return initList.slice(0, displayCount);
  }, [initList, displayCount]);

  const hasMore = useMemo(() => {
    return displayCount < initList.length;
  }, [displayCount, initList.length]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  return {
    data: displayList,
    loadMore,
    hasMore,
  };
};

export default useLoadMoreData;
