import { atom, useAtom } from 'jotai';
import { AbstractPortfolioToken } from '@/screens/Home/types';

const visibleAtom = atom({
  isShowGuidePopup: false,
  isShowLoginPopup: false,
  isShowDepositPopup: false,
  isShowDepositTokenPopup: false,
  isShowWithdrawPopup: false,
  isShowDeleteAgentPopup: false,
  isShowSearchListPopup: false,
  searchListOpenFrom: 'searchPerps' as 'openPosition' | 'searchPerps',
});

const selectedTokenAtom = atom<AbstractPortfolioToken | null>(null);

export const usePerpsPopupState = () => {
  return useAtom(visibleAtom);
};

export const useSelectedToken = () => {
  return useAtom(selectedTokenAtom);
};
