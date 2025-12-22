import {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';
import { useCallback } from 'react';

const quoteVisibleState = zCreate<{ visible: boolean }>(() => ({
  visible: false,
}));
export function setQuoteVisible(valOrFunc: UpdaterOrPartials<boolean>) {
  quoteVisibleState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.visible, valOrFunc, {
      strict: false,
    });

    return { ...prev, visible: newVal };
  });
}
export const useQuoteVisible = () => {
  const visible = quoteVisibleState(state => state.visible);

  return [visible, setQuoteVisible] as const;
};
export const useSetQuoteVisible = () => setQuoteVisible;

const rabbyFeeVisibleState = zCreate<{
  visible: boolean;
  dexFeeDesc?: string;
  dexName?: string;
}>(() => ({
  visible: false,
}));

export function setRabbyFeeVisible(
  valOrFunc: UpdaterOrPartials<{
    visible: boolean;
    dexFeeDesc?: string;
    dexName?: string;
  }>,
) {
  rabbyFeeVisibleState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export const useRabbyFeeVisible = () => {
  const state = rabbyFeeVisibleState();

  return [state, setRabbyFeeVisible] as const;
};

const refreshIdStore = zCreate<number>(() => 0);

export function swapRefresh() {
  refreshIdStore.setState(prev => prev + 1);
}

export const useRefreshId = () => {
  return refreshIdStore();
};

// Zustand implementation for refreshId
function setRefreshId(valOrFunc: UpdaterOrPartials<number>) {
  refreshIdStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

// Helper function to increment refreshId
export const incrementRefreshId = () => {
  setRefreshId(prev => prev + 1);
};

type LongPressTokenState = {
  visible: boolean;
  position: { x: number; y: number; height: number };
  tokenEntity: TokenItemWithEntity | null;
  tokenItem: TokenItem | null;
};

const longPressTokenStore = zCreate<LongPressTokenState>(() => ({
  visible: false,
  position: { x: 0, y: 0, height: 0 },
  tokenEntity: null,
  tokenItem: null,
}));

export function setLongPressToken(
  valOrFunc: UpdaterOrPartials<LongPressTokenState>,
) {
  longPressTokenStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

export const useLongPressToken = () => {
  const state = longPressTokenStore();

  return [state, setLongPressToken] as const;
};

const isFromBackStore = zCreate<boolean>(() => true);
export const useIsFromBack = () => {
  const isFromBack = isFromBackStore();
  return { isFromBack, setIsFromBack };
};
export const setIsFromBack = (valOrFunc: UpdaterOrPartials<boolean>) => {
  isFromBackStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
};
