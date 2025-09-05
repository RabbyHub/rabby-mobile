import { atom, useAtom } from 'jotai';

const visibleAtom = atom({
  isShowGuidePopup: false,
  isShowLoginPopup: false,
  isShowLogoutPopup: false,
  isShowDepositPopup: false,
  isShowWithdrawPopup: false,
  isShowDeleteAgentPopup: false,
});

export const usePerspPopupState = () => {
  return useAtom(visibleAtom);
};
