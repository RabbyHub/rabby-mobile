import { PermissionsAndroid, Platform } from 'react-native';

import { preferenceService } from '@/core/services';
import DeviceUtils from '@/core/utils/device';
import { PerAndroid } from '@/core/utils/permissions';
import { IS_ANDROID } from '@/core/native/utils';
import PushNotificationIOS, {
  PushNotificationPermissions,
} from '@react-native-community/push-notification-ios';

export function iosCheckPermission(): Promise<PushNotificationPermissions> {
  return new Promise(resolve => {
    PushNotificationIOS.checkPermissions(permissions => {
      resolve(permissions);
    });
  });
}

export const checkNotificationPermission = async (): Promise<boolean> => {
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
  appEnabled?: boolean,
) {
  const enabled =
    appEnabled ??
    preferenceService.getPreferenceByKey('enabledTransactionNofification') ??
    true;

  const hasPermission = await checkNotificationPermission();
  // console.debug('[debug] checkIfEnabledNotificationWithPermission:: enabled, hasPermission', enabled, hasPermission);

  return enabled && hasPermission;
}
