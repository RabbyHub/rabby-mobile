import { atom, useAtom, useSetAtom } from 'jotai';

const quoteVisibleAtom = atom(false);

export const useQuoteVisible = () => useAtom(quoteVisibleAtom);

export const useSetQuoteVisible = () => useSetAtom(quoteVisibleAtom);

export const refreshIdAtom = atom(0, (get, set, _) => {
  set(refreshIdAtom, get(refreshIdAtom) + 1);
});
