import {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom, useSetAtom } from 'jotai';

const quoteVisibleAtom = atom(false);
const rabbyFeeVisibleAtom = atom({ visible: false } as {
  visible: boolean;
  dexFeeDesc?: string;
  dexName?: string;
});

export const useQuoteVisible = () => useAtom(quoteVisibleAtom);

export const useSetQuoteVisible = () => useSetAtom(quoteVisibleAtom);

export const useRabbyFeeVisible = () => useAtom(rabbyFeeVisibleAtom);

export const refreshIdAtom = atom(0, (get, set, _) => {
  set(refreshIdAtom, get(refreshIdAtom) + 1);
});

const longPressTokenAtom = atom({
  visible: false,
  position: { x: 0, y: 0, height: 0 },
  tokenEntity: null,
  tokenItem: null,
} as {
  visible: boolean;
  position: { x: number; y: number; height: number };
  tokenEntity: TokenItemWithEntity | null;
  tokenItem: TokenItem | null;
});

export const useLongPressTokenAtom = () => useAtom(longPressTokenAtom);
// 是否从返回按钮进入
export const isFromBackAtom = atom(true);
