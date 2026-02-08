import React from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { apiKeystone } from '@/core/apis';
import { ellipsisAddress } from '@/utils/address';
import { toast } from '@/components2024/Toast';
import { useImportKeystone } from './useImportKeystone';

export function useKeystoneDeviceActions() {
  const { t } = useTranslation();
  const goImport = useImportKeystone();

  const openConnectKeystoneModal = React.useCallback(() => {
    let preserveActiveForImportMore = false;
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.CONNECT_KEYSTONE,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        onDismiss: () => {
          if (!preserveActiveForImportMore) {
            apiKeystone.clearActiveKeystoneKeyring();
          }
        },
      },
      onDone: result => {
        preserveActiveForImportMore = !!result?.preserveActiveForImportMore;
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, []);

  const handleImportMoreKeystone = React.useCallback(async () => {
    try {
      const devices = (await apiKeystone.getKeystoneDevices()).filter(
        item => item.accountsCount > 0,
      );
      if (!devices.length) {
        apiKeystone.clearActiveKeystoneKeyring();
        openConnectKeystoneModal();
        return;
      }

      if (devices.length === 1) {
        goImport({ deviceId: devices[0]!.deviceId });
        return;
      }

      Alert.alert(
        t('page.newAddress.keystone.selectDevice'),
        t('page.newAddress.keystone.chooseDevice'),
        [
          ...devices.map(device => ({
            text: `${
              device.primaryAddress
                ? ellipsisAddress(device.primaryAddress)
                : device.fingerprint
            } (${device.accountsCount})`,
            onPress: () => goImport({ deviceId: device.deviceId }),
          })),
          {
            text: t('global.Cancel'),
            style: 'cancel' as const,
            onPress: () => apiKeystone.clearActiveKeystoneKeyring(),
          },
        ],
      );
    } catch (error: any) {
      toast.error(
        error?.message || t('page.newAddress.keystone.loadDevicesFailed'),
      );
    }
  }, [goImport, openConnectKeystoneModal, t]);

  return { openConnectKeystoneModal, handleImportMoreKeystone };
}
