import { atom, useAtom } from 'jotai';

const visibleAtom = atom({
  isShowGuidePopup: false,
  isShowLoginPopup: false,
  isShowLogoutPopup: false,
  isShowDepositPopup: false,
  isShowWithdrawPopup: false,
  isShowDeleteAgentPopup: false,
  isShowSwapPopup: false,
});

export const usePerpsPopupState = () => {
  return useAtom(visibleAtom);
};
