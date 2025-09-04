import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

const gasLevelAtom = atom<'normal' | 'slow' | 'fast' | 'custom'>('normal');
const customPriceAtom = atom(0);

export const useMiniSignGasStore = () => {
  const [miniGasLevel, setMiniGasLevel] = useAtom(gasLevelAtom);
  const [miniCustomPrice, setMiniCustomPrice] = useAtom(customPriceAtom);

  const reset = useCallback(() => {
    setMiniGasLevel('normal');
    setMiniCustomPrice(0);
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
