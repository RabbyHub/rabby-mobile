import { preferenceService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import { useShallow } from 'zustand/react/shallow';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useCallback } from 'react';

export const BALANCE_HIDE_TYPE = {
  HIDE: 'HIDE',
  SHOW: 'SHOW',
  HALF_HIDE: 'HALF_HIDE',
} as const;

export type BALANCE_HIDE_TYPE =
  (typeof BALANCE_HIDE_TYPE)[keyof typeof BALANCE_HIDE_TYPE];

type HideBalanceState = {
  hideType: BALANCE_HIDE_TYPE;
};

const hideBalanceStore = zCreate<HideBalanceState>(() => {
  return {
    hideType: BALANCE_HIDE_TYPE.SHOW,
  };
});

function setHideBalanceState(valOrFunc: UpdaterOrPartials<HideBalanceState>) {
  hideBalanceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    // Save to preference service
    if (newVal.hideType) {
      preferenceService.setPreference({
        balanceHideType: newVal.hideType,
      });
    }
    return newVal;
  });
}

export function initializeHideBalanceState() {
  runIIFEFunc(() => {
    const hideType =
      preferenceService.getPreference('balanceHideType') ||
      BALANCE_HIDE_TYPE.SHOW;
    setHideBalanceState({ hideType });
  });
}

export const useHideBalance = () => {
  const hideType = hideBalanceStore(useShallow(state => state.hideType));

  const setHideType = useCallback(
    (
      update: ((v: BALANCE_HIDE_TYPE) => BALANCE_HIDE_TYPE) | BALANCE_HIDE_TYPE,
    ) => {
      setHideBalanceState(prev => {
        const currentHideType = prev.hideType;
        const nextValue =
          typeof update === 'function'
            ? (update as (v: BALANCE_HIDE_TYPE) => BALANCE_HIDE_TYPE)(
                currentHideType,
              )
            : update;
        return { ...prev, hideType: nextValue };
      });
    },
    [],
  );

  return [hideType, setHideType] as const;
};
