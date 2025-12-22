import { swapService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';

const slippageState = zCreate<string>(() => {
  return swapService.getSlippage();
});
runIIFEFunc(() => {
  const slippage = swapService.getSlippage();
  slippageState.setState(slippage);
});
function setSlippage(valOrFunc: UpdaterOrPartials<string>) {
  slippageState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    swapService.setSlippage(newVal);
    return newVal;
  });
}

const autoSlippageState = zCreate<boolean>(() => {
  return swapService.getAutoSlippage();
});
runIIFEFunc(() => {
  const autoSlippage = swapService.getAutoSlippage();
  autoSlippageState.setState(autoSlippage);
});
function setAutoSlippage(valOrFunc: UpdaterOrPartials<boolean>) {
  autoSlippageState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    swapService.setAutoSlippage(newVal);
    return newVal;
  });
}

const isCustomSlippageState = zCreate<boolean>(() => {
  return !!swapService.getIsCustomSlippage();
});
runIIFEFunc(() => {
  const isCustomSlippage = !!swapService.getIsCustomSlippage();
  isCustomSlippageState.setState(isCustomSlippage);
});
function setIsCustomSlippage(valOrFunc: UpdaterOrPartials<boolean>) {
  isCustomSlippageState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    swapService.setIsCustomSlippage(newVal);
    return newVal;
  });
}

export const useSlippageStore = () => {
  const slippage = slippageState();
  const autoSlippage = autoSlippageState();
  const isCustomSlippage = isCustomSlippageState();

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
