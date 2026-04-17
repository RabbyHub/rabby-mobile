import { atom, useAtom } from 'jotai';

const visibleAtom = atom({
  isShowGuidePopup: false,
  isShowLoginPopup: false,
  isShowLogoutPopup: false,
  isShowDepositPopup: false,
  isShowWithdrawPopup: false,
  isShowDeleteAgentPopup: false,
  isShowSearchListPopup: false,
  isShowSwapPopup: false,
  searchListOpenFrom: 'searchPerps' as 'openPosition' | 'searchPerps',
  searchListDirection: undefined as 'Long' | 'Short' | undefined,
});

export const usePerpsPopupState = () => {
  return useAtom(visibleAtom);
};
