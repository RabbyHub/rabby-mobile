import { atom, useSetAtom } from 'jotai';

export const singleTokenNonceAtom = atom<number>(0);
export const singleDeFiNonceAtom = atom<number>(0);
export const singleNFTNonceAtom = atom<number>(0);
export const tokenNonceAtom = atom<number>(0);
export const deFiNonceAtom = atom<number>(0);
export const nftNonceAtom = atom<number>(0);

export const useTriggerTagAssets = () => {
  const singleTokenNonceUpdate = useSetAtom(singleTokenNonceAtom);
  const singleDeFiNonceUpdate = useSetAtom(singleDeFiNonceAtom);
  const singleNFTNonceUpdate = useSetAtom(singleNFTNonceAtom);
  const tokenNonceUpdate = useSetAtom(tokenNonceAtom);
  const deFiNonceUpdate = useSetAtom(deFiNonceAtom);
  const nftNonceUpdate = useSetAtom(nftNonceAtom);
  return {
    singleTokenRefresh: () => {
      singleTokenNonceUpdate(prev => prev + 1);
    },
    singleDeFiRefresh: () => {
      singleDeFiNonceUpdate(prev => prev + 1);
    },
    singleNFTRefresh: () => {
      singleNFTNonceUpdate(prev => prev + 1);
    },
    tokenRefresh: () => {
      tokenNonceUpdate(prev => prev + 1);
    },
    deFiRefresh: () => {
      deFiNonceUpdate(prev => prev + 1);
    },
    nftRefresh: () => {
      nftNonceUpdate(prev => prev + 1);
    },
  };
};
