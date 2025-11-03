import { atom, useAtom } from 'jotai';
import { AbstractPortfolioToken } from '@/screens/Home/types';

const visibleAtom = atom({
  isShowGuidePopup: false,
  isShowLoginPopup: false,
  isShowLogoutPopup: false,
  isShowDepositPopup: false,
  isShowDepositTokenPopup: false,
  isShowWithdrawPopup: false,
  isShowDeleteAgentPopup: false,
  isShowSearchListPopup: false,
});

const selectedTokenAtom = atom<AbstractPortfolioToken | null>(null);

export const usePerpsPopupState = () => {
  return useAtom(visibleAtom);
};

export const useSelectedToken = () => {
  return useAtom(selectedTokenAtom);
};
