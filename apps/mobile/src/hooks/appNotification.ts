import {
  Alert,
  AppState,
  PermissionsAndroid,
  PermissionStatus,
  Platform,
} from 'react-native';

import { preferenceService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { UseValueHook } from '@/screens/Settings/components/SwitchSettingCommon';
import DeviceUtils from '@/core/utils/device';
import { goToSystemSettingsFor, PerAndroid } from '@/core/utils/permissions';
import { IS_ANDROID } from '@/core/native/utils';
import i18next from 'i18next';
import PushNotificationIOS, {
  PushNotificationPermissions,
} from '@react-native-community/push-notification-ios';

const appNotificationStore = zCreate<{
  /**
   * @description null means not checked yet
   */
  hasSystemPermission: boolean | null;
  enabledTransactionNofification: boolean;
}>(() => {
  return {
    hasSystemPermission: null,
    enabledTransactionNofification:
      preferenceService.getPreferenceByKey('enabledTransactionNofification') ??
      true,
  };
});

function iosCheckPermission(): Promise<PushNotificationPermissions> {
  return new Promise(resolve => {
    PushNotificationIOS.checkPermissions(permissions => {
      resolve(permissions);
    });
  });
}

const checkNotificationPermission = async (): Promise<boolean> => {
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

const requestUngrantedNotificationPermission = async () => {
  if (IS_ANDROID) {
    if (DeviceUtils.isGteAndroid(13)) {
      return PerAndroid.applyAndroidPermission(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    } else {
      return 'granted';
    }
  } else {
    return 'denied';
  }
};

async function fetchHasSystemPermission() {
  const hasSystemPermission = await checkNotificationPermission();
  appNotificationStore.setState({ hasSystemPermission });

  return hasSystemPermission;
}

export function useAppHasSystemNotificationPermission(): boolean | null {
  return appNotificationStore(s => s.hasSystemPermission);
}

runIIFEFunc(async () => {
  const hasPermission = await fetchHasSystemPermission();

  if (!hasPermission) {
    await requestUngrantedNotificationPermission();
    await fetchHasSystemPermission();
  }

  AppState.addEventListener('change', async state => {
    if (state === 'active') {
      fetchHasSystemPermission();
    }
  });
});

export async function setEnableTransactionNofification(
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  fetchHasSystemPermission();
  const hasSystemPermission =
    appNotificationStore.getState().hasSystemPermission;
  if (!hasSystemPermission) {
    const reqResult = await requestUngrantedNotificationPermission();
    if (
      (IS_ANDROID && reqResult === 'never_ask_again') ||
      reqResult === 'denied'
    ) {
      Alert.alert(
        i18next.t('global.permissionRequest.postNotification.title'),
        i18next.t(
          'global.permissionRequest.postNotification.pleaseEnableInSettings',
        ),
        [
          { text: i18next.t('global.cancel'), style: 'cancel' },
          {
            text: i18next.t('global.permissionRequest.common.goToSettings'),
            onPress: () => goToSystemSettingsFor(),
          },
        ],
      );
    }

    if (reqResult !== 'granted') {
      return;
    }
  }

  const prevHasSystemPermission = hasSystemPermission;
  appNotificationStore.setState(state => {
    let { newVal } = resolveValFromUpdater(
      state.enabledTransactionNofification,
      valOrFunc,
      { strict: false },
    );
    if (!prevHasSystemPermission) newVal = true;

    preferenceService.setPreferenceByKey(
      'enabledTransactionNofification',
      newVal,
    );

    return { enabledTransactionNofification: newVal };
  });
}

export const useAppNotificationEnabled: UseValueHook = () => {
  const enabledTransactionNofification = appNotificationStore(
    s => s.enabledTransactionNofification,
  );
  const hasSystemPermission = appNotificationStore(s => s.hasSystemPermission);
  // console.debug(
  //   '[feat] useAppNotificationEnabled:: enabledTransactionNofification, hasSystemPermission',
  //   enabledTransactionNofification,
  //   hasSystemPermission,
  // );

  return {
    value: hasSystemPermission === true && enabledTransactionNofification,
    setValue: setEnableTransactionNofification,
  };
};
