import { DEX } from '@/constant/swap';
import { openapi } from '@/core/request';
import { swapService } from '@/core/services';
import { useMemo } from 'react';
import { zCreate } from '@/core/utils/reexports';
import {
  UpdaterOrPartials,
  resolveValFromUpdater,
  runIIFEFunc,
} from '@/core/utils/store';
import { useCallback } from 'react';

const swapUnlimitedAllowanceStore = zCreate<boolean>(() =>
  swapService.getUnlimitedAllowance(),
);
function setSwapUnlimitedAllowance(valOrFunc: UpdaterOrPartials<boolean>) {
  swapUnlimitedAllowanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    swapService.setUnlimitedAllowance(newVal);

    return newVal;
  });
}

export const useSwapUnlimitedAllowance = () => {
  const state = swapUnlimitedAllowanceStore();

  const setState = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setSwapUnlimitedAllowance(valOrFunc);
  }, []);

  return [state, setState] as const;
};

const getSettings = () => ({
  swapViewList: swapService.getSwapViewList(),
  swapTradeList: swapService.getSwapTradeList(),
  selectedChain: swapService.getSelectedChain(),
  sortIncludeGasFee: swapService.getSwapSortIncludeGasFee(),
});

type SettingSwapState = ReturnType<typeof getSettings>;
const settingSwapStore = zCreate<SettingSwapState>(() => getSettings());
runIIFEFunc(() => {
  settingSwapStore.setState(getSettings());
});

function setSettingSwap(valOrFunc: UpdaterOrPartials<SettingSwapState>) {
  settingSwapStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    if (!changed) return prev;

    return newVal;
  });
}

function wrapSwapSettingsMethod<
  T extends Record<string, (...args: any[]) => void>,
>(
  obj: T,
  cb: () => void,
): { [K in keyof T]: (...args: Parameters<T[K]>) => void } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      (...args: Parameters<T[typeof k]>) => {
        v(...args);
        cb();
      },
    ]),
  ) as { [K in keyof T]: (...args: Parameters<T[K]>) => void };
}

export const useSwapSettings = () => {
  const settings = settingSwapStore();

  const methods = useMemo(() => {
    const {
      setSelectedChain,
      setSwapTrade,
      setSwapView,
      setSwapSortIncludeGasFee,
    } = swapService;
    return wrapSwapSettingsMethod(
      {
        setSelectedChain,
        setSwapTrade,
        setSwapView,
        setSwapSortIncludeGasFee,
      },
      () => {
        setSettingSwap(getSettings());
      },
    );
  }, []);

  return {
    ...settings,
    ...methods,
  };
};

const swapSupportedDexListStore = zCreate<string[]>(() => Object.keys(DEX));
runIIFEFunc(() => {
  openapi.getSupportedDEXList().then(s => {
    swapSupportedDexListStore.setState(s.dex_list?.filter(e => DEX[e]) || []);
  });
});
export const useSwapSupportedDexList = () => {
  return [swapSupportedDexListStore()];
};

export const useSwapViewDexIdList = () => {
  const viewList = settingSwapStore().swapViewList;
  const dexList = swapSupportedDexListStore();
  return dexList.filter(e => viewList[e] !== false);
};

export const useSwapViewDexIdListZ = () => {
  const settings = settingSwapStore();
  const dexList = swapSupportedDexListStore();
  return dexList.filter(e => settings.swapViewList[e] !== false);
};
