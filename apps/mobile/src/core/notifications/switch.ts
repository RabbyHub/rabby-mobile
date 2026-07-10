import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { getPreferenceSnapshot } from '@/core/serviceApi';
import DeviceUtils from '@/core/utils/device';
import { PerAndroid } from '@/core/utils/permissions';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import type {
  PushNotificationPermissions,
} from '@react-native-community/push-notification-ios';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { APP_FEATURE_SWITCH } from '@/constant';

export function iosCheckPermission(): Promise<PushNotificationPermissions> {
  return new Promise(resolve => {
    PushNotificationIOS.checkPermissions(permissions => {
      resolve(permissions);
    });
  });
}

export const checkNotificationPermission = async (): Promise<boolean> => {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return false;
  }

  if (Platform.OS === 'ios') {
    const settings = await iosCheckPermission();

    return settings.alert === true;
  }

  if (DeviceUtils.isGteAndroid(13)) {
    const status = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return status;
  }

  return true;
};

export const requestUngrantedNotificationPermission = async () => {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return 'denied';
  }

  if (IS_ANDROID) {
    if (DeviceUtils.isGteAndroid(13)) {
      return PerAndroid.applyAndroidPermission(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    } else {
      return 'granted';
    }
  } else {
    const authStatus = await PushNotificationIOS.requestPermissions({
      alert: true,
      badge: true,
      sound: true,
    });

    if (authStatus.alert || authStatus.badge || authStatus.sound) {
      return 'granted';
    }

    return 'denied';
  }
};

export async function checkIfEnabledNotificationWithPermission(
  inputAppEnabled?: boolean,
) {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return {
      hasPermission: false,
      appEnabled: false,
      iosDisabledDueToForeground: false,
      enabled: false,
    };
  }

  const appEnabled =
    inputAppEnabled ??
    getPreferenceSnapshot('enabledTransactionNofification') ??
    true;

  const hasPermission = await checkNotificationPermission();
  // console.debug('[debug] checkIfEnabledNotificationWithPermission:: appEnabled, hasPermission', appEnabled, hasPermission);

  const iosDisabledDueToForeground =
    IS_IOS && AppState.isAvailable && AppState.currentState !== 'active';

  return {
    hasPermission,
    appEnabled: appEnabled,
    iosDisabledDueToForeground,
    enabled: appEnabled && hasPermission /*  && !iosDisabledDueToForeground */,
  };
}
