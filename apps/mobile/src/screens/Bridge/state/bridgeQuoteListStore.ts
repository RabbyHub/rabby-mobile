import { createStore } from 'zustand/vanilla';

import { useScopedActivityStore } from '@/hooks/storeActivity/useActivityStore';
import type { SelectedBridgeQuote } from '../types';

export type BridgeQuoteListState = {
  list: SelectedBridgeQuote[];
};

export const bridgeQuoteListStore = createStore<BridgeQuoteListState>()(() => ({
  list: [],
}));

export function setBridgeQuoteList(
  updater:
    | SelectedBridgeQuote[]
    | ((prev: SelectedBridgeQuote[]) => SelectedBridgeQuote[]),
) {
  bridgeQuoteListStore.setState(state => ({
    list: typeof updater === 'function' ? updater(state.list) : updater,
  }));
}

export const getBridgeQuoteList = () => bridgeQuoteListStore.getState().list;

export const getBridgeQuoteListLength = () =>
  bridgeQuoteListStore.getState().list.length;

export function useBridgeQuoteList(active: boolean) {
  return useScopedActivityStore(
    active,
    bridgeQuoteListStore,
    state => state.list,
    Object.is,
    { storeLabel: 'bridge-quote-list' },
  );
}
