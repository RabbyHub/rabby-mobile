import React from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

type QrCodeModalState = {
  visible: boolean;
  data: any;
};

const qrCodeModalStore = zCreate<QrCodeModalState>(() => ({
  visible: false,
  data: undefined,
}));

export function setVisible(valOrFunc: UpdaterOrPartials<boolean>) {
  qrCodeModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.visible, valOrFunc);
    return { ...prev, visible: newVal };
  });
}

function setData(valOrFunc: UpdaterOrPartials<any>) {
  qrCodeModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.data, valOrFunc);
    return { ...prev, data: newVal };
  });
}

export const useQrCodeModal = () => {
  const show = React.useCallback((a: any) => {
    setVisible(true);
    setData(a);
  }, []);

  const hide = React.useCallback(() => {
    setVisible(false);
  }, []);

  return { show, hide };
};

export function useQrCodeModalStore() {
  return qrCodeModalStore(
    useShallow(state => ({
      visible: state.visible,
      data: state.data,
    })),
  );
}
