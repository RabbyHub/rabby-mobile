import { preferenceService } from '@/core/services';
import {
  BALANCE_HIDE_TYPE as BALANCE_HIDE_TYPE_CONST,
  type BALANCE_HIDE_TYPE as BalanceHideType,
} from '@/constant/balanceHide';
import { atom, useAtom } from 'jotai';

export const BALANCE_HIDE_TYPE = BALANCE_HIDE_TYPE_CONST;
export type BALANCE_HIDE_TYPE = BalanceHideType;

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
