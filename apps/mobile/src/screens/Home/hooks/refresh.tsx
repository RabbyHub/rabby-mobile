import { atom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

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
    singleTokenRefresh: useCallback(() => {
      singleTokenNonceUpdate(prev => prev + 1);
    }, [singleTokenNonceUpdate]),
    singleDeFiRefresh: useCallback(() => {
      singleDeFiNonceUpdate(prev => prev + 1);
    }, [singleDeFiNonceUpdate]),
    singleNFTRefresh: useCallback(() => {
      singleNFTNonceUpdate(prev => prev + 1);
    }, [singleNFTNonceUpdate]),
    tokenRefresh: useCallback(() => {
      tokenNonceUpdate(prev => prev + 1);
    }, [tokenNonceUpdate]),
    deFiRefresh: useCallback(() => {
      deFiNonceUpdate(prev => prev + 1);
    }, [deFiNonceUpdate]),
    nftRefresh: useCallback(() => {
      nftNonceUpdate(prev => prev + 1);
    }, [nftNonceUpdate]),
  };
};
