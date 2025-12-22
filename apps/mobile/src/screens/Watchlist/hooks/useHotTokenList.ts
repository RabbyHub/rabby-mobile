import { openapi } from '@/core/request';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useState } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

const hotTokenListStore = zCreate<TokenDetailWithPriceCurve[]>(() => []);

function setHotTokenList(
  valOrFunc: UpdaterOrPartials<TokenDetailWithPriceCurve[]>,
) {
  hotTokenListStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
}

export const useHotTokenList = (visible?: boolean) => {
  const hotTokenList = hotTokenListStore();
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
    [hotTokenList.length],
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
