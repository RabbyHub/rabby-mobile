import { atom, useSetAtom } from 'jotai';

export const singleTokenNounceAtom = atom<number>(0);
export const singleDeFiNounceAtom = atom<number>(0);
export const singleNFTNounceAtom = atom<number>(0);
export const tokenNounceAtom = atom<number>(0);
export const deFiNounceAtom = atom<number>(0);
export const nftNounceAtom = atom<number>(0);

export const useTriggerTagAssets = () => {
  const singleTokenNounceUpdate = useSetAtom(singleTokenNounceAtom);
  const singleDeFiNounceUpdate = useSetAtom(singleDeFiNounceAtom);
  const singleNFTNounceUpdate = useSetAtom(singleNFTNounceAtom);
  const tokenNounceUpdate = useSetAtom(tokenNounceAtom);
  const deFiNounceUpdate = useSetAtom(deFiNounceAtom);
  const nftNounceUpdate = useSetAtom(nftNounceAtom);
  return {
    singleTokenRefresh: () => {
      singleTokenNounceUpdate(prev => prev + 1);
    },
    singleDeFiRefresh: () => {
      singleDeFiNounceUpdate(prev => prev + 1);
    },
    singleNFTRefresh: () => {
      singleNFTNounceUpdate(prev => prev + 1);
    },
    tokenRefresh: () => {
      tokenNounceUpdate(prev => prev + 1);
    },
    deFiRefresh: () => {
      deFiNounceUpdate(prev => prev + 1);
    },
    nftRefresh: () => {
      nftNounceUpdate(prev => prev + 1);
    },
  };
};
