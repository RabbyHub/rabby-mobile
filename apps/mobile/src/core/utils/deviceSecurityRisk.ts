import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import RNHelpers from '@/core/native/RNHelpers';
import { apisAppWin2024 } from '@/core/serviceApi/appWin';
import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import i18n from '@/utils/i18n';

const ACKNOWLEDGED_KEY =
  APP_MMKV_WEAK_KEYS.DEVICE_SECURITY_WARNING_ACKNOWLEDGED;

export async function showDeviceSecurityRiskWarningIfNeeded() {
  if (appStorage.getItem(ACKNOWLEDGED_KEY) === true) {
    return;
  }

  try {
    if (!(await RNHelpers.checkDeviceSecurityRisk())) {
      return;
    }
  } catch {
    return;
  }

  const modalId = apisAppWin2024.createGlobalBottomSheetModal({
    name: MODAL_NAMES.SIMPLE_CONFIRM,
    title: i18n.t('global.deviceSecurityRisk.title'),
    description: i18n.t('global.deviceSecurityRisk.message'),
    confirmText: i18n.t('global.confirm'),
    onConfirm: () => {
      appStorage.setItem(ACKNOWLEDGED_KEY, true);
      void apisAppWin2024.removeGlobalBottomSheetModal(modalId);
    },
    bottomSheetModalProps: {
      enableDynamicSizing: true,
      enablePanDownToClose: false,
      backdropProps: { pressBehavior: 'none' },
    },
  });
}
