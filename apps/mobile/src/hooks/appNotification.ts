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
import {
  checkNotificationPermission,
  requestUngrantedNotificationPermission,
} from '@/core/notifications/switch';

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
      false,
  };
});

export async function fetchHasSystemPermission() {
  const hasSystemPermission = await checkNotificationPermission();
  appNotificationStore.setState({ hasSystemPermission });

  return hasSystemPermission;
}

export async function startCareAppNotificationPermissions() {
  const hasPermission = await fetchHasSystemPermission();

  if (
    !hasPermission &&
    appNotificationStore.getState().enabledTransactionNofification
  ) {
    await requestUngrantedNotificationPermission();
    await fetchHasSystemPermission();
  }

  AppState.addEventListener('change', async state => {
    if (state === 'active') {
      fetchHasSystemPermission();
    }
  });
}

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

export function useAppHasSystemNotificationPermission(): boolean | null {
  return appNotificationStore(s => s.hasSystemPermission);
}

export const useAppNotificationEnabled = () => {
  const enabledTransactionNofification = appNotificationStore(
    s => s.enabledTransactionNofification,
  );
  const hasSystemPermission = appNotificationStore(s => s.hasSystemPermission);

  return {
    enabledTransactionNofification,
    hasSystemPermission,
    value: hasSystemPermission === true && enabledTransactionNofification,
    setValue: setEnableTransactionNofification,
  };
};
