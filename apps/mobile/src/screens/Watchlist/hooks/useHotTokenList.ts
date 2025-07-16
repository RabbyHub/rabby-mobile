import { openapi } from '@/core/request';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

export const hotTokenListAtom = atom<TokenDetailWithPriceCurve[]>([]);

export const useHotTokenList = (visible?: boolean) => {
  const [hotTokenList, setHotTokenList] = useAtom(hotTokenListAtom);
  const [loading, setLoading] = useState(false);

  const getHotTokenList = useCallback(
    async (force = false) => {
      try {
        if (!force && hotTokenList.length > 0) {
          return;
        }
        setLoading(true);
        const hotTokenListRes = await openapi.getHotTokenList();
        setHotTokenList(hotTokenListRes);
        setLoading(false);
      } catch (error) {
        console.error('getHotTokenList error', error);
        setLoading(false);
        return [];
      }
    },
    [hotTokenList.length, setHotTokenList],
  );

  useEffect(() => {
    if (visible) {
      getHotTokenList();
    }
  }, [getHotTokenList, visible]);

  return {
    hotTokenList,
    handleFetchHotTokenList: getHotTokenList,
    loading,
  };
};
