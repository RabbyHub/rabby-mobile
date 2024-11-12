import { atom, useAtom } from 'jotai';
import React from 'react';

export const visibleAtom = atom(false);
export const dataAtom = atom(undefined);

export const useQrCodeModal = () => {
  const [_, setVisible] = useAtom(visibleAtom);
  const [_1, setData] = useAtom(dataAtom);

  const show = React.useCallback(
    a => {
      setVisible(true);
      setData(a);
    },
    [setData, setVisible],
  );

  const hide = React.useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  return { show, hide };
};
