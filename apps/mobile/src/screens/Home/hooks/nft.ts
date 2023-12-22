import { openapi } from '@/core/request';
import { CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useState } from 'react';

export const useQueryNft = (addr: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [list, setList] = useState<CollectionList[]>([]);

  const fetchData = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const collections = await openapi.collectionList({
        id,
        isAll: false,
      });

      setList(collections);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (addr) {
      fetchData(addr);
    }
  }, [addr, fetchData]);

  return {
    isLoading,
    list,
  };
};
