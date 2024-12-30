import { swapService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';

const _recentToTokensAtom = atom(swapService.getRecentSwapToTokens());

const recentToTokensAtom = atom(
  get => get(_recentToTokensAtom),
  (get, set, newVal: TokenItem) => {
    swapService.setRecentSwapToToken(newVal);
    const newToTokens = swapService.getRecentSwapToTokens();
    set(_recentToTokensAtom, newToTokens);
  },
);

export const useSwapRecentToTokens = () => {
  return useAtom(recentToTokensAtom);
};
