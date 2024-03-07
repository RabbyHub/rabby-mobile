import { swapService } from '@/core/services';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';

const swapUnlimitedAllowanceAtom = atom(false, (get, set, bool: boolean) => {
  swapService.setUnlimitedAllowance(bool);
  set(swapUnlimitedAllowanceAtom, bool);
});

swapUnlimitedAllowanceAtom.onMount = s => {
  s(swapService.getUnlimitedAllowance());
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

const getSettings = () => ({
  swapViewList: swapService.getSwapViewList(),
  swapTradeList: swapService.getSwapTradeList(),
  selectedChain: swapService.getSelectedChain(),
  sortIncludeGasFee: swapService.getSwapSortIncludeGasFee(),
});

const settingSwapAtom = atom(getSettings());

settingSwapAtom.onMount = setAtom => {
  setAtom(getSettings());
};

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
  const [settings, setSettings] = useAtom(settingSwapAtom);

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
        setSettings(getSettings());
      },
    );
  }, [setSettings]);

  return {
    ...settings,
    ...methods,
  };
};
