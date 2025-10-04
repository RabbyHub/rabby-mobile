import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { toastIndicator } from '@/components/Toast';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { apiOneKey } from '@/core/apis';
import { atom, useAtom } from 'jotai';
import React from 'react';

export const oneKeyStatusAtom = atom<'CONNECTED' | 'DISCONNECTED' | undefined>(
  'CONNECTED',
);

export const useOneKeyStatus = (
  address: string,
  extra?: {
    onDismiss?(): void;
    autoConnect?: boolean;
  },
) => {
  const [status, setStatus] = useAtom(oneKeyStatusAtom);
  const [deviceId, setDeviceId] = React.useState<string>();
  let toastHiddenRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    if (extra?.autoConnect ?? true) {
      apiOneKey.isConnected(address).then(([isConnected, id]) => {
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
        name: MODAL_NAMES.CONNECT_ONEKEY,
        deviceId,
        onSelectDeviceId: async (connectDeviceId: string) => {
          toastHiddenRef.current = toastIndicator('Connecting', {
            isTop: true,
          });

          try {
            await apiOneKey.setDeviceConnectId(connectDeviceId);
            await apiOneKey.unlockDevice();
            await apiOneKey.fixConnectId(address, connectDeviceId);
            setStatus('CONNECTED');
            isConnected = true;
            cb?.();
          } catch (e) {
            rej?.();
            setStatus('DISCONNECTED');
          } finally {
            setTimeout(() => {
              removeGlobalBottomSheetModal2024(id);
            }, 0);
            toastHiddenRef.current?.();
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

  React.useEffect(() => {
    return () => {
      toastHiddenRef.current?.();
    };
  }, []);

  return {
    onClickConnect,
    status,
  };
};
