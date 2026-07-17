import { swapServiceApi } from '@/core/serviceApi/swap';
import type { SwapService } from '@/core/services/swap';
import { useAtom } from 'jotai';
import { createRaceSafeHydratedAtom } from './raceSafeHydratedAtom';

const slippageAtom = createRaceSafeHydratedAtom({
  initialValue: '0.1',
  hydrate: () => swapServiceApi.getSlippage(),
  commitUpdate: async (_previous, slippage: string) => {
    await swapServiceApi.setSlippage(slippage);
    return slippage;
  },
});

const autoSlippageAtom = createRaceSafeHydratedAtom({
  initialValue: true,
  hydrate: () => swapServiceApi.getAutoSlippage(),
  commitUpdate: async (_previous, value: boolean) => {
    await swapServiceApi.setAutoSlippage(value);
    return value;
  },
});

const isCustomSlippageAtom = createRaceSafeHydratedAtom({
  initialValue: false,
  hydrate: async () => !!(await swapServiceApi.getIsCustomSlippage()),
  commitUpdate: async (_previous, value: boolean) => {
    await swapServiceApi.setIsCustomSlippage(value);
    return value;
  },
});

export function prepareSwapSlippageFromService(service: SwapService) {
  slippageAtom.prepare(service.getSlippage());
  autoSlippageAtom.prepare(service.getAutoSlippage());
  isCustomSlippageAtom.prepare(!!service.getIsCustomSlippage());
}

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
