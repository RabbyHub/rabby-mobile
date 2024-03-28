import { sleep } from '@/utils/async';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PAGI_START = 1;
/**
 * @description ensure page valid in range, but not less than 0
 */
function getValidPage(newPage: number, totalPage: number) {
  let validPage = Math.min(newPage, totalPage);
  validPage = Math.max(PAGI_START, validPage);

  return validPage;
}

/**
 * @description paging locally
 */
export function usePsudoPagination<T extends any>(
  fullList: T[],
  options?:
    | number
    | {
        pageSize: number;
      },
) {
  options = typeof options === 'number' ? { pageSize: options } : options;
  const { pageSize = 10 } = options || {};
  const [currentPage, setCurrentPage] = useState(PAGI_START);

  const { currentPageList, fallList } = useMemo(() => {
    const offset = currentPage - PAGI_START;
    const currentList: T[] = fullList.slice(
      offset * pageSize,
      (offset + 1) * pageSize,
    );
    const fallList = fullList.slice(0, currentPage * pageSize);

    return {
      currentPageList: currentList,
      fallList,
    };
  }, [currentPage, fullList, pageSize]);

  const { total, maxPage } = useMemo(() => {
    return {
      total: fullList.length,
      maxPage: Math.ceil(fullList.length / pageSize),
    };
  }, [fullList.length, pageSize]);

  const goToPage = useCallback(
    (newPage: number) => {
      setCurrentPage(getValidPage(newPage, maxPage));
    },
    [maxPage],
  );

  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => getValidPage(prev + PAGI_START, maxPage));
  }, [maxPage]);

  const simulateLoadNext = useCallback(
    async (timeout = 1000) => {
      setIsFetchingNextPage(true);

      try {
        await sleep(timeout);
        goToNextPage();
      } catch (err) {
        console.error(err);
      } finally {
        setIsFetchingNextPage(false);
      }
    },
    [goToNextPage],
  );

  const isReachTheEnd = useMemo(() => {
    return currentPage >= maxPage;
  }, [currentPage, maxPage]);

  const resetPage = useCallback(() => {
    setCurrentPage(PAGI_START);
  }, []);

  return {
    currentPageList,
    fallList,
    total,
    goToPage,
    resetPage,

    goToNextPage,
    simulateLoadNext,
    isFetchingNextPage,
    isReachTheEnd,
  };
}
