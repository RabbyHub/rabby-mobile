import { openapi } from '@/core/request';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNFTsAtom } from './store';

export const useQueryNft = (addr?: string, visible = true) => {
  const [isLoading, setIsLoading] = useState(false);
  const preAddressRef = useRef<string>();
  const [list, setList] = useNFTsAtom(addr);

  const fetchData = useCallback(
    async (id: string) => {
      try {
        console.log('🔍 CUSTOM_LOGGER:=>: nft==loadProcess)', id);
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

  const reload = async () => {
    if (addr) {
      await fetchData(addr);
    }
  };

  useEffect(() => {
    if (addr !== preAddressRef.current) {
      preAddressRef.current = addr;
      setList([]);
    }
    if (addr && visible) {
      fetchData(addr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, visible]);

  return {
    isLoading,
    list,
    reload,
  };
};
