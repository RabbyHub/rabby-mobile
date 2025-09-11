import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';

const miniSignTypedDataSign = atom<boolean>(false);

export const useSetMiniSigningTypedData = () =>
  useSetAtom(miniSignTypedDataSign);
export const useGetMiniSigningTypedData = () =>
  useAtomValue(miniSignTypedDataSign);

export const useResetMiniSigningTypedData = () => {
  const setMiniSignTypedDataSign = useSetAtom(miniSignTypedDataSign);
  const reset = useCallback(() => {
    setMiniSignTypedDataSign(false);
  }, [setMiniSignTypedDataSign]);
  return reset;
};
