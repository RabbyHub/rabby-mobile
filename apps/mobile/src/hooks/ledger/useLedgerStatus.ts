import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { apiLedger } from '@/core/apis';
import { atom, getDefaultStore, useAtom } from 'jotai';
import React from 'react';
import { Device } from 'react-native-ble-plx';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

export const ledgerStatusAtom = atom<'CONNECTED' | 'DISCONNECTED' | undefined>(
  'CONNECTED',
);

export const useLedgerStatus = (
  address: string,
  extra?: {
    onDismiss?(): void;
    autoConnect?: boolean;
  },
) => {
  const [status, setStatus] = useAtom(ledgerStatusAtom);
  const [deviceId, setDeviceId] = React.useState<string>();

  React.useEffect(() => {
    if (extra?.autoConnect ?? true) {
      apiLedger.isConnected(address).then(([isConnected, id]) => {
        setStatus(isConnected ? 'CONNECTED' : 'DISCONNECTED');
        if (id) {
          setDeviceId(id);
        }
      });
    }
  }, [address, setStatus, extra?.autoConnect]);

  const onClickConnect = React.useCallback(
    (cb?: () => void, rej?: () => void) => {
      let isConnected = false;
      const onDismiss = extra?.onDismiss;
      const id = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.CONNECT_LEDGER,
        deviceId,
        onSelectDevice: async (d: Device) => {
          console.log('selected device', d.id);
          try {
            await TransportBLE.open(d.id);
            apiLedger.fixDeviceId(address, d.id);
            setStatus('CONNECTED');
            isConnected = true;
            cb?.();
          } catch (e) {
            console.log('ledger connect error', e);
            await TransportBLE.disconnectDevice(d.id);
            rej?.();
            setStatus('DISCONNECTED');
          } finally {
            setTimeout(() => {
              removeGlobalBottomSheetModal2024(id);
            }, 0);
          }
        },
        bottomSheetModalProps: {
          onDismiss: () => {
            if (!isConnected) {
              rej?.();
            }
            onDismiss?.();
          },
        },
      });
    },
    [address, deviceId, extra?.onDismiss, setStatus],
  );

  return {
    onClickConnect,
    status,
  };
};

export const setLedgerStatus = (connected?: boolean) => {
  getDefaultStore().set(
    ledgerStatusAtom,
    connected ? 'CONNECTED' : 'DISCONNECTED',
  );
};

export const callConnectLedgerModal = ({
  deviceId,
  cb,
  reject,
  address,
  onDismiss,
}: {
  deviceId?: string;
  cb?: () => void;
  reject?: () => void;
  address: string;
  onDismiss?: () => void;
}) => {
  let isConnected = false;
  const id = createGlobalBottomSheetModal2024({
    name: MODAL_NAMES.CONNECT_LEDGER,
    deviceId,
    onSelectDevice: async (d: Device) => {
      console.log('selected device', d.id);
      try {
        await TransportBLE.open(d.id);
        apiLedger.fixDeviceId(address, d.id);
        isConnected = true;
        setLedgerStatus(true);
        cb?.();
      } catch (e) {
        console.log('ledger connect error', e);
        await TransportBLE.disconnectDevice(d.id);
        setLedgerStatus(false);
        reject?.();
      } finally {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      }
    },
    bottomSheetModalProps: {
      onDismiss: () => {
        if (!isConnected) {
          reject?.();
        }
        onDismiss?.();
      },
    },
  });
};
