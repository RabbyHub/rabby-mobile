import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { apiLedger } from '@/core/apis';
import { atom, useAtom } from 'jotai';
import React from 'react';
import { Device } from 'react-native-ble-plx';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';

export const ledgerStatusAtom = atom<'CONNECTED' | 'DISCONNECTED' | undefined>(
  'CONNECTED',
);

export const useLedgerStatus = (address: string) => {
  const [status, setStatus] = useAtom(ledgerStatusAtom);
  const [deviceId, setDeviceId] = React.useState<string>();

  React.useEffect(() => {
    apiLedger.isConnected(address).then(([isConnected, id]) => {
      setStatus(isConnected ? 'CONNECTED' : 'DISCONNECTED');
      if (id) {
        setDeviceId(id);
      }
    });
  }, [address, setStatus]);

  const onClickConnect = React.useCallback(
    (cb?: () => void) => {
      const id = createGlobalBottomSheetModal({
        name: MODAL_NAMES.CONNECT_LEDGER,
        deviceId,
        onSelectDevice: async (d: Device) => {
          console.log('selected device', d.id);
          setTimeout(() => {
            removeGlobalBottomSheetModal(id);
          }, 0);
          try {
            await TransportBLE.open(d.id);
            setStatus('CONNECTED');
            cb?.();
          } catch (e) {
            console.log('ledger connect error', e);
            await TransportBLE.disconnectDevice(d.id);
            setStatus('DISCONNECTED');
          }
        },
      });
    },
    [deviceId, setStatus],
  );

  return {
    onClickConnect,
    status,
  };
};
