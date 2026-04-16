import { atom, useAtom } from 'jotai';

const showSearchBottomAtom = atom(false);

export const useShowSearchBottomSheet = () => {
  return useAtom(showSearchBottomAtom);
};
