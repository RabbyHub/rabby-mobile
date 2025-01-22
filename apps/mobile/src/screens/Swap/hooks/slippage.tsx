import { swapService } from '@/core/services';
import { atom, useAtom } from 'jotai';

const slippageAtom = atom(
  swapService.getSlippage(),
  (get, set, slippage: string) => {
    swapService.setSlippage(slippage);
    set(slippageAtom, slippage);
  },
);

slippageAtom.onMount = set => {
  set(swapService.getSlippage());
};

const autoSlippageAtom = atom(
  swapService.getAutoSlippage(),
  (get, set, bool: boolean) => {
    swapService.setAutoSlippage(bool);
    set(autoSlippageAtom, bool);
  },
);

autoSlippageAtom.onMount = set => {
  set(swapService.getAutoSlippage());
};

const isCustomSlippageAtom = atom(
  !!swapService.getIsCustomSlippage(),
  (get, set, bool: boolean) => {
    swapService.setIsCustomSlippage(bool);
    set(isCustomSlippageAtom, bool);
  },
);

isCustomSlippageAtom.onMount = set => {
  set(!!swapService.getIsCustomSlippage());
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
