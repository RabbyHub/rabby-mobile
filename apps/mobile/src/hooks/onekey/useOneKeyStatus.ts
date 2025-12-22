import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { toastIndicator } from '@/components/Toast';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { apiOneKey } from '@/core/apis';
import { noop } from 'lodash';
import React from 'react';
import { zCreate } from '@/core/utils/reexports';

type OneKeyStatus = 'CONNECTED' | 'DISCONNECTED' | undefined;

const oneKeyStatusStore = zCreate<{ status: OneKeyStatus }>(() => ({
  status: 'CONNECTED',
}));

export const useOneKeyStatus = (
  address: string,
  extra?: {
    onDismiss?(): void;
    autoConnect?: boolean;
  },
) => {
  const [status, setStatus] = React.useState<OneKeyStatus>('CONNECTED');
  const [deviceId, setDeviceId] = React.useState<string>();
  let toastHiddenRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    if (extra?.autoConnect ?? true) {
      apiOneKey.isConnected(address).then(([isConnected, id]) => {
        const newStatus = isConnected ? 'CONNECTED' : 'DISCONNECTED';
        setStatus(newStatus);
        oneKeyStatusStore.setState({ status: newStatus });
        if (id) {
          setDeviceId(id);
        }
      });
    }
  }, [address, extra?.autoConnect]);

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
            oneKeyStatusStore.setState({ status: 'CONNECTED' });
            isConnected = true;
            cb?.();
          } catch (e) {
            rej?.();
            setStatus('DISCONNECTED');
            oneKeyStatusStore.setState({ status: 'DISCONNECTED' });
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
    [address, deviceId, extra?.onDismiss],
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

export const setOneKeyStatus = (connected?: boolean) => {
  const status = connected ? 'CONNECTED' : 'DISCONNECTED';
  oneKeyStatusStore.setState({ status });
};

export const callConnectOneKeyModal = ({
  deviceId,
  cb,
  reject: rej,
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
  let toastCb = noop;
  const id = createGlobalBottomSheetModal2024({
    name: MODAL_NAMES.CONNECT_ONEKEY,
    deviceId,
    onSelectDeviceId: async (connectDeviceId: string) => {
      toastCb = toastIndicator('Connecting', {
        isTop: true,
      });

      try {
        await apiOneKey.setDeviceConnectId(connectDeviceId);
        await apiOneKey.unlockDevice();
        await apiOneKey.fixConnectId(address, connectDeviceId);
        isConnected = true;
        setOneKeyStatus(true);
        cb?.();
      } catch (e) {
        setOneKeyStatus(false);
        rej?.();
      } finally {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
        toastCb?.();
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
};
