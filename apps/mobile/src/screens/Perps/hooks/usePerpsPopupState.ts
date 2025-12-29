import { atom, useAtom } from 'jotai';
import { ITokenItem } from '@/store/tokens';

const visibleAtom = atom({
  isShowGuidePopup: false,
  isShowLoginPopup: false,
  isShowLogoutPopup: false,
  isShowDepositPopup: false,
  isShowDepositTokenPopup: false,
  isShowWithdrawPopup: false,
  isShowDeleteAgentPopup: false,
  isShowSearchListPopup: false,
  searchListOpenFrom: 'searchPerps' as 'openPosition' | 'searchPerps',
});

const selectedTokenAtom = atom<ITokenItem | null>(null);

export const usePerpsPopupState = () => {
  return useAtom(visibleAtom);
};

export const useSelectedToken = () => {
  return useAtom(selectedTokenAtom);
};
