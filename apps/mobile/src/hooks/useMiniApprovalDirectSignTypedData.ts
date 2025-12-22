import { useCallback } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

// Zustand implementation for miniSignTypedDataSign
const miniSignTypedDataSignStore = zCreate<boolean>(() => false);

function setMiniSignTypedDataSignState(valOrFunc: UpdaterOrPartials<boolean>) {
  miniSignTypedDataSignStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export const useSetMiniSigningTypedData = () => {
  return useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setMiniSignTypedDataSignState(valOrFunc);
  }, []);
};

export const useGetMiniSigningTypedData = () => miniSignTypedDataSignStore();

export const useResetMiniSigningTypedData = () => {
  const setMiniSignTypedDataSign = useCallback(
    (valOrFunc: UpdaterOrPartials<boolean>) => {
      setMiniSignTypedDataSignState(valOrFunc);
    },
    [],
  );

  const reset = useCallback(() => {
    setMiniSignTypedDataSign(false);
  }, [setMiniSignTypedDataSign]);

  return reset;
};
