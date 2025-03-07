import { atom, useAtom } from 'jotai';

const addressAtom = atom('');

export const useIAPAccountAddress = () => {
  return useAtom(addressAtom);
};
