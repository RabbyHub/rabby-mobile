import { DEX } from '@/constant/swap';
import { openapi } from '@/core/request';
import { swapServiceApi } from '@/core/serviceApi/swap';
import type { SwapServiceStore, ViewKey } from '@/core/services/swap';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';

const swapUnlimitedAllowanceAtom = atom(false, (get, set, bool: boolean) => {
  void swapServiceApi.setUnlimitedAllowance(bool).catch(console.error);
  set(swapUnlimitedAllowanceAtom, bool);
});

swapUnlimitedAllowanceAtom.onMount = s => {
  void swapServiceApi.getUnlimitedAllowance().then(s).catch(console.error);
};

export const useSwapUnlimitedAllowance = () =>
  useAtom(swapUnlimitedAllowanceAtom);

const swapSettingsVisibleAtom = atom(false);

export const useSwapSettingsVisible = () => {
  const [visible, setVisible] = useAtom(swapSettingsVisibleAtom);
  return {
    visible,
    setVisible,
  };
};

const swapSupportedDexList = atom<string[]>(Object.keys(DEX));

swapSupportedDexList.onMount = setAtom => {
  openapi.getSupportedDEXList().then(s => {
    setAtom(s.dex_list?.filter(e => DEX[e]));
  });
};

type SwapSettingsState = {
  swapViewList: SwapServiceStore['viewList'];
  swapTradeList: SwapServiceStore['tradeList'];
  selectedChain: SwapServiceStore['selectedChain'];
  sortIncludeGasFee: boolean;
};

const defaultSettings: SwapSettingsState = {
  swapViewList: {} as SwapServiceStore['viewList'],
  swapTradeList: {} as SwapServiceStore['tradeList'],
  selectedChain: null,
  sortIncludeGasFee: true,
};

const getSettings = async (): Promise<SwapSettingsState> => ({
  swapViewList: await swapServiceApi.getSwapViewList(),
  swapTradeList: await swapServiceApi.getSwapTradeList(),
  selectedChain: await swapServiceApi.getSelectedChain(),
  sortIncludeGasFee: await swapServiceApi.getSwapSortIncludeGasFee(),
});

const settingSwapAtom = atom(defaultSettings);

settingSwapAtom.onMount = setAtom => {
  getSettings().then(setAtom);
};

function wrapSwapSettingsMethod<
  T extends Record<string, (...args: any[]) => Promise<unknown>>,
>(
  obj: T,
  cb: () => Promise<void>,
): { [K in keyof T]: (...args: Parameters<T[K]>) => Promise<void> } {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      async (...args: Parameters<T[typeof k]>) => {
        await v(...args);
        await cb();
      },
    ]),
  ) as { [K in keyof T]: (...args: Parameters<T[K]>) => Promise<void> };
}

export const useSwapSettings = () => {
  const [settings, setSettings] = useAtom(settingSwapAtom);

  const methods = useMemo(() => {
    return wrapSwapSettingsMethod(
      {
        setSelectedChain: (
          chain: NonNullable<SwapServiceStore['selectedChain']>,
        ) => swapServiceApi.setSelectedChain(chain),
        setSwapTrade: (dexId: ViewKey, bool: boolean) =>
          swapServiceApi.setSwapTrade(dexId, bool),
        setSwapView: (id: ViewKey, bool: boolean) =>
          swapServiceApi.setSwapView(id, bool),
        setSwapSortIncludeGasFee: (bool: boolean) =>
          swapServiceApi.setSwapSortIncludeGasFee(bool),
      },
      async () => {
        setSettings(await getSettings());
      },
    );
  }, [setSettings]);

  return {
    ...settings,
    ...methods,
  };
};

export const useSwapSupportedDexList = () => useAtom(swapSupportedDexList);

export const useSwapViewDexIdList = () => {
  const viewList = useAtom(settingSwapAtom)[0].swapViewList;
  const [dexList] = useAtom(swapSupportedDexList);
  return dexList.filter(e => viewList[e] !== false);
};
