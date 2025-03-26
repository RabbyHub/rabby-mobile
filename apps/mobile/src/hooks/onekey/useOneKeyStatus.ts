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

export const useOneKeyStatus = (address: string) => {
  const [status, setStatus] = useAtom(oneKeyStatusAtom);
  const [deviceId, setDeviceId] = React.useState<string>();
  let toastHiddenRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    apiOneKey.isConnected(address).then(([isConnected, id]) => {
      setStatus(isConnected ? 'CONNECTED' : 'DISCONNECTED');
      if (id) {
        setDeviceId(id);
      }
    });
  }, [address, setStatus]);

  const onClickConnect = React.useCallback(
    (cb?: () => void) => {
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
            cb?.();
          } catch (e) {
            console.log('ledger connect error', e);
            setStatus('DISCONNECTED');
          } finally {
            setTimeout(() => {
              removeGlobalBottomSheetModal2024(id);
            }, 0);
            toastHiddenRef.current?.();
          }
        },
      });
    },
    [address, deviceId, setStatus],
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
