import { openapi } from '@/core/request';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNFTsAtom } from './store';

export const useQueryNft = (addr?: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const preAddressRef = useRef<string>();
  const [list, setList] = useNFTsAtom(addr);

  const fetchData = useCallback(
    async (id: string) => {
      try {
        setIsLoading(true);
        const ntfs = await openapi.listNFT(id, true, true);
        preAddressRef.current = id;
        setList(ntfs);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [setList],
  );

  const reload = () => {
    if (addr) {
      fetchData(addr);
    }
  };

  useEffect(() => {
    if (addr !== preAddressRef.current) {
      preAddressRef.current = addr;
      setList([]);
    }
    if (addr) {
      fetchData(addr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr]);

  return {
    isLoading,
    list,
    reload,
  };
};
