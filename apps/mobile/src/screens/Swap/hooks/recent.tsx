import { swapServiceApi } from '@/core/serviceApi/swap';
import type { SwapService } from '@/core/services/swap';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useAtom } from 'jotai';
import { createRaceSafeHydratedAtom } from './raceSafeHydratedAtom';

const recentToTokensAtom = createRaceSafeHydratedAtom<TokenItem[], TokenItem>({
  initialValue: [],
  hydrate: () => swapServiceApi.getRecentSwapToTokens(),
  commitUpdate: async (_previous, token) => {
    await swapServiceApi.setRecentSwapToToken(token);
    return swapServiceApi.getRecentSwapToTokens();
  },
});

export function prepareSwapRecentTokensFromService(service: SwapService) {
  recentToTokensAtom.prepare(service.getRecentSwapToTokens());
}

export const useSwapRecentToTokens = () => {
  return useAtom(recentToTokensAtom);
};
