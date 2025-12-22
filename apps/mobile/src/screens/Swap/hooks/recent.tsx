import { swapService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';
import { useCallback as useZCallback } from 'react';

// Zustand implementation for recentToTokens
type RecentToTokensState = TokenItem[];
const recentToTokensStore = zCreate<RecentToTokensState>(() =>
  swapService.getRecentSwapToTokens(),
);

function setRecentToTokens(valOrFunc: UpdaterOrPartials<RecentToTokensState>) {
  recentToTokensStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

// Keep the old jotai implementation for backward compatibility
export const useSwapRecentToTokens = () => {
  const state = recentToTokensStore();

  const setState = useZCallback(
    (valOrFunc: UpdaterOrPartials<RecentToTokensState> | TokenItem) => {
      if (
        typeof valOrFunc === 'object' &&
        valOrFunc !== null &&
        !Array.isArray(valOrFunc)
      ) {
        // Handle the case where a single TokenItem is passed
        const tokenItem = valOrFunc as TokenItem;
        swapService.setRecentSwapToToken(tokenItem);
        const newToTokens = swapService.getRecentSwapToTokens();
        setRecentToTokens(newToTokens);
      } else {
        setRecentToTokens(valOrFunc as UpdaterOrPartials<RecentToTokensState>);
      }
    },
    [],
  );

  return [state, setState] as const;
};

export const useSwapRecentToTokensZ = () => {
  const state = recentToTokensStore();

  const setState = useZCallback(
    (valOrFunc: UpdaterOrPartials<RecentToTokensState> | TokenItem) => {
      if (
        typeof valOrFunc === 'object' &&
        valOrFunc !== null &&
        !Array.isArray(valOrFunc)
      ) {
        // Handle the case where a single TokenItem is passed
        const tokenItem = valOrFunc as TokenItem;
        swapService.setRecentSwapToToken(tokenItem);
        const newToTokens = swapService.getRecentSwapToTokens();
        setRecentToTokens(newToTokens);
      } else {
        setRecentToTokens(valOrFunc as UpdaterOrPartials<RecentToTokensState>);
      }
    },
    [],
  );

  return [state, setState] as const;
};
