import { Alert } from 'react-native';

import RNHelpers from '@/core/native/RNHelpers';
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

  Alert.alert(
    i18n.t('global.deviceSecurityRisk.title'),
    i18n.t('global.deviceSecurityRisk.message'),
    [
      {
        text: i18n.t('global.confirm'),
        onPress: () => {
          appStorage.setItem(ACKNOWLEDGED_KEY, true);
        },
      },
    ],
    { cancelable: false },
  );
}
