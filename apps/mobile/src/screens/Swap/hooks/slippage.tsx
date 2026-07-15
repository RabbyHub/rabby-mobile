import { swapServiceApi } from '@/core/serviceApi/swap';
import { atom, useAtom } from 'jotai';

const slippageAtom = atom('0.1', async (get, set, slippage: string) => {
  await swapServiceApi.setSlippage(slippage);
  set(slippageAtom, slippage);
});

slippageAtom.onMount = set => {
  void swapServiceApi.getSlippage().then(set).catch(console.error);
};

const autoSlippageAtom = atom(true, async (get, set, bool: boolean) => {
  await swapServiceApi.setAutoSlippage(bool);
  set(autoSlippageAtom, bool);
});

autoSlippageAtom.onMount = set => {
  void swapServiceApi.getAutoSlippage().then(set).catch(console.error);
};

const isCustomSlippageAtom = atom(false, async (get, set, bool: boolean) => {
  await swapServiceApi.setIsCustomSlippage(bool);
  set(isCustomSlippageAtom, bool);
});

isCustomSlippageAtom.onMount = set => {
  void swapServiceApi
    .getIsCustomSlippage()
    .then(value => set(!!value))
    .catch(console.error);
};

export const useSlippageStore = () => {
  const [slippage, setSlippage] = useAtom(slippageAtom);
  const [autoSlippage, setAutoSlippage] = useAtom(autoSlippageAtom);
  const [isCustomSlippage, setIsCustomSlippage] = useAtom(isCustomSlippageAtom);

  return {
    slippage,
    setSlippage,
    autoSlippage,
    setAutoSlippage,
    isCustomSlippage,
    setIsCustomSlippage,
  };
};

export const getSwapAutoSlippageValue = (isStableCoin: boolean) => {
  return isStableCoin ? '0.1' : '3';
};
