import { DEX } from '@/constant/swap';
import { openapi } from '@/core/request';
import { swapServiceApi } from '@/core/serviceApi/swap';
import type { SwapServiceStore, ViewKey } from '@/core/services/swap';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { createRaceSafeHydratedAtom } from './raceSafeHydratedAtom';

const swapUnlimitedAllowanceAtom = createRaceSafeHydratedAtom({
  initialValue: false,
  hydrate: () => swapServiceApi.getUnlimitedAllowance(),
  optimisticUpdate: (_previous, value: boolean) => value,
  commitUpdate: async (_previous, value: boolean) => {
    await swapServiceApi.setUnlimitedAllowance(value).catch(console.error);
    return value;
  },
});

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
let swapSettingsMutationRevision = 0;
let swapSettingsRefreshRevision = 0;

settingSwapAtom.onMount = setAtom => {
  const revision = swapSettingsMutationRevision;
  void getSettings()
    .then(settings => {
      if (revision === swapSettingsMutationRevision) {
        setAtom(settings);
      }
    })
    .catch(console.error);
};

function wrapSwapSettingsMethod<
  T extends Record<string, (...args: any[]) => Promise<unknown>>,
>(
  obj: T,
  readSettings: () => Promise<SwapSettingsState>,
  applySettings: (settings: SwapSettingsState) => void,
): { [K in keyof T]: (...args: Parameters<T[K]>) => Promise<void> } {
  const refreshSettings = async () => {
    const refreshRevision = ++swapSettingsRefreshRevision;
    const settings = await readSettings();
    if (refreshRevision === swapSettingsRefreshRevision) {
      applySettings(settings);
    }
  };

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      async (...args: Parameters<T[typeof k]>) => {
        ++swapSettingsMutationRevision;
        try {
          await v(...args);
        } catch (error) {
          await refreshSettings().catch(console.error);
          throw error;
        }
        await refreshSettings();
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
      getSettings,
      setSettings,
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
