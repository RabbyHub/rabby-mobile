import { gasAccountProducts } from '@/constant/iap';
import { atom, useAtom } from 'jotai';

const productsAtom = atom(gasAccountProducts);
export const useIAPProducts = () => {
  return useAtom(productsAtom);
};
