import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { apiLedger } from '@/core/apis';
import { atom, useAtom } from 'jotai';
import React from 'react';
import { Device } from 'react-native-ble-plx';

const statusAtom = atom<'CONNECTED' | 'DISCONNECTED' | undefined>('CONNECTED');

export const useLedgerStatus = (address: string) => {
  const [status, setStatus] = useAtom(statusAtom);

  React.useEffect(() => {
    apiLedger.isConnected(address).then(isConnected => {
      setStatus(isConnected ? 'CONNECTED' : 'DISCONNECTED');
    });
  }, [address, setStatus]);

  const onClickConnect = React.useCallback(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.CONNECT_LEDGER,
      onSelectDevice: (d: Device) => {
        console.log('selected device', d.id);
        removeGlobalBottomSheetModal(id);
        setStatus('CONNECTED');
      },
    });
  }, [setStatus]);

  return {
    onClickConnect,
    status,
  };
};
