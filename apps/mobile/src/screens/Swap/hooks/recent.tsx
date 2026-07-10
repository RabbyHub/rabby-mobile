import { swapServiceApi } from '@/core/serviceApi';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';

const _recentToTokensAtom = atom<TokenItem[]>([]);

_recentToTokensAtom.onMount = set => {
  swapServiceApi.getRecentSwapToTokens().then(set);
};

const recentToTokensAtom = atom(
  get => get(_recentToTokensAtom),
  async (get, set, newVal: TokenItem) => {
    await swapServiceApi.setRecentSwapToToken(newVal);
    const newToTokens = await swapServiceApi.getRecentSwapToTokens();
    set(_recentToTokensAtom, newToTokens);
  },
);

export const useSwapRecentToTokens = () => {
  return useAtom(recentToTokensAtom);
};
