import { atomByMMKV, MMKVStorageStrategy } from '@/core/storage/mmkv';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

export const fixedCustomGasAtom = atomByMMKV(
  'miniSignCustomGas',
  {} as {
    [key: number]: number;
  },
  { storage: MMKVStorageStrategy.compatJson },
);

const gasLevelAtom = atom<'normal' | 'slow' | 'fast' | 'custom'>('normal');
const customPriceAtom = atom<{
  [key: number]: number;
}>({});

export const useMemoMiniSignGasStore = () => {
  const [miniGasLevel, setMiniGasLevel] = useAtom(gasLevelAtom);
  const [miniCustomPrice, setMiniCustomPrice] = useAtom(customPriceAtom);

  const reset = useCallback(() => {
    setMiniGasLevel('normal');
    setMiniCustomPrice({});
  }, [setMiniGasLevel, setMiniCustomPrice]);

  return {
    miniGasLevel,
    setMiniGasLevel,
    miniCustomPrice,
    setMiniCustomPrice,
    updateMiniCustomPrice: setMiniCustomPrice,
    reset,
  };
};

export const useMiniSignFixedMode = (chainId?: number) => {
  const fixedCustomGas = useAtomValue(fixedCustomGasAtom);

  if (!chainId) {
    return false;
  }

  const num = fixedCustomGas?.[chainId];

  return typeof num === 'number' ? true : false;
};

export const useMiniSignGasStoreOrigin = () => {
  const [miniGasLevel, setMiniGasLevel] = useAtom(gasLevelAtom);
  const [miniCustomPrice, setMiniCustomPrice] = useAtom(customPriceAtom);
  const [fixedCustomGas, setFixedCustomGas] = useAtom(fixedCustomGasAtom);
  return {
    miniGasLevel,
    setMiniGasLevel,
    miniCustomPrice,
    setMiniCustomPrice,
    fixedCustomGas,
    setFixedCustomGas,
  };
};
export const useMiniSignGasStore = (chainId: number) => {
  const [miniGasLevel, setMiniGasLevel] = useAtom(gasLevelAtom);
  const [miniCustomPrice, setMiniCustomPrice] = useAtom(customPriceAtom);
  const [fixedCustomGas, setFixedCustomGas] = useAtom(fixedCustomGasAtom);

  const currentMiniSignGasLevel =
    fixedCustomGas?.[chainId] !== undefined ? 'custom' : miniGasLevel;

  const currentMiniCustomGas =
    fixedCustomGas?.[chainId] ?? miniCustomPrice?.[chainId];

  const updateMiniGas = useCallback(
    (params: {
      gasLevel: typeof miniGasLevel;
      chainId: number;
      customGasPrice?: number;
      fixed?: boolean;
    }) => {
      const isCustom = params.gasLevel === 'custom';
      setMiniGasLevel(params.gasLevel);

      setMiniCustomPrice(() =>
        isCustom
          ? {
              [params.chainId]: params.customGasPrice || 0,
            }
          : {},
      );

      const isFixedMode = isCustom && !!params.fixed;
      console.log('isFixedMode updateMiniGas', isFixedMode);

      setFixedCustomGas(pre => {
        let data = { ...pre };
        delete data[params.chainId];

        if (isFixedMode) {
          data[params.chainId] = params.customGasPrice || 0;
        }

        return data;
      });
    },
    [setFixedCustomGas, setMiniCustomPrice, setMiniGasLevel],
  );

  return {
    currentMiniSignGasLevel,
    currentMiniCustomGas,
    updateMiniGas,
  };
};
// 内置功能签名
// - 页面记忆 Instant/Fast/Normal, 重进页面前有效；
// - 链记忆 Custom，切链或重进页面前有效；
// - 每次重进页面重置为默认档位 Fast。
export const useClearMiniGasStateEffect = ({
  chainServerId,
}: {
  chainServerId?: string;
}) => {
  const { miniGasLevel, reset } = useMemoMiniSignGasStore();
  useEffect(() => {
    reset();
    return reset;
  }, [reset]);

  const [previousChainServerId, setPreviousChainServerId] =
    useState(chainServerId);

  if (previousChainServerId !== chainServerId) {
    setPreviousChainServerId(chainServerId);
    if (miniGasLevel === 'custom') {
      reset();
    }
  }
};
