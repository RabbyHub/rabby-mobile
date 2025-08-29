import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

const gasLevelAtom = atom<'normal' | 'slow' | 'fast' | 'custom'>('normal');
const customPriceAtom = atom<Record<string, number>>({});

export const useMiniSignGasStore = () => {
  const [miniGasLevel, setMiniGasLevel] = useAtom(gasLevelAtom);
  const [miniCustomPrice, setMiniCustomPrice] = useAtom(customPriceAtom);

  const reset = useCallback(() => {
    setMiniGasLevel('normal');
    setMiniCustomPrice({});
  }, [setMiniGasLevel, setMiniCustomPrice]);

  const updateMiniCustomPrice = (chainServerId: string, value: number) => {
    setMiniCustomPrice(pre => ({
      ...pre,
      [chainServerId]: value,
    }));
  };

  return {
    miniGasLevel,
    setMiniGasLevel,
    miniCustomPrice,
    setMiniCustomPrice,
    updateMiniCustomPrice,
    reset,
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
  const { miniGasLevel, reset } = useMiniSignGasStore();
  useEffect(() => {
    reset();
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
