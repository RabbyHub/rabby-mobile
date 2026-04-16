import { BALANCE_HIDE_TYPE } from '@/constant/balance';
import { preferenceService } from '@/core/services';
import { atom, useAtom } from 'jotai';

const baseHideTypeAtom = atom<BALANCE_HIDE_TYPE>(BALANCE_HIDE_TYPE.SHOW);

baseHideTypeAtom.onMount = setAtom => {
  const hideType =
    preferenceService.getPreference('balanceHideType') ||
    BALANCE_HIDE_TYPE.SHOW;
  setAtom(hideType);
};

const hideTypeAtom = atom<
  BALANCE_HIDE_TYPE,
  [((v: BALANCE_HIDE_TYPE) => BALANCE_HIDE_TYPE) | BALANCE_HIDE_TYPE],
  void
>(
  get => {
    return get(baseHideTypeAtom);
  },
  (get, set, update) => {
    const nextValue =
      typeof update === 'function' ? update(get(baseHideTypeAtom)) : update;
    set(baseHideTypeAtom, nextValue);
    preferenceService.setPreference({
      balanceHideType: nextValue,
    });
  },
);

export const useHideBalance = () => {
  return useAtom(hideTypeAtom);
};
