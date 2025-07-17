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
        setHotTokenList(
          hotTokenListRes.sort((a, b) => {
            // ETH-ETH 默认排在最前面
            const aIsEthEth =
              a.chain.toLowerCase() === 'eth' && a.id.toLowerCase() === 'eth';
            const bIsEthEth =
              b.chain.toLowerCase() === 'eth' && b.id.toLowerCase() === 'eth';

            if (aIsEthEth && !bIsEthEth) {
              return -1;
            }
            if (!aIsEthEth && bIsEthEth) {
              return 1;
            }

            // 其他代币按 fdv 排序
            return (b.identity?.fdv ?? 0) - (a.identity?.fdv ?? 0);
          }),
        );
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
