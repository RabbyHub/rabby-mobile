import { sleep } from '@/utils/async';
import { useCallback, useEffect, useMemo, useState } from 'react';

function getValidPage(newPage: number, totalPage: number) {
  let validPage = Math.max(1, newPage);
  validPage = Math.min(validPage, totalPage);

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
  const [currentPage, setCurrentPage] = useState(1);

  const { currentPageList, fallList, total, totalPage } = useMemo(() => {
    const currentList: T[] = fullList.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
    const fallList = fullList.slice(0, currentPage * pageSize);
    const totalPage = Math.ceil(fullList.length / pageSize);

    return {
      currentPageList: currentList,
      fallList,
      total: fullList.length,
      totalPage,
    };
  }, [currentPage, fullList, pageSize]);

  const goToPage = useCallback(
    (newPage: number) => {
      setCurrentPage(getValidPage(newPage, totalPage));
    },
    [totalPage],
  );

  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => getValidPage(prev + 1, totalPage));
  }, [totalPage]);

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
    return currentPage >= totalPage;
  }, [currentPage, totalPage]);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPageList,
    fallList,
    total,
    currentPage,
    totalPage,
    goToPage,
    resetPage,

    goToNextPage,
    simulateLoadNext,
    isFetchingNextPage,
    isReachTheEnd,
  };
}
