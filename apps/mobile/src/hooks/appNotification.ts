import {
  Alert,
  AppState,
  PermissionsAndroid,
  PermissionStatus,
  Platform,
} from 'react-native';

import {
  getPreferenceSnapshot,
  setPreferenceByKey,
} from '@/core/serviceApi/preference';
import { zCreate } from '@/core/utils/reexports';
import type {
  UpdaterOrPartials} from '@/core/utils/store';
import {
  resolveValFromUpdater,
  runIIFEFunc
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
import { APP_FEATURE_SWITCH } from '@/constant';

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
      APP_FEATURE_SWITCH.transactionNotification &&
      (getPreferenceSnapshot('enabledTransactionNofification') ??
        false),
  };
});

export async function fetchHasSystemPermission() {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    appNotificationStore.setState({
      hasSystemPermission: false,
      enabledTransactionNofification: false,
    });

    return false;
  }

  const hasSystemPermission = await checkNotificationPermission();
  appNotificationStore.setState({ hasSystemPermission });

  return hasSystemPermission;
}

export async function startCareAppNotificationPermissions() {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return;
  }

  const hasSystemPermission = await fetchHasSystemPermission();

  if (
    !hasSystemPermission &&
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
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    appNotificationStore.setState({
      hasSystemPermission: false,
      enabledTransactionNofification: false,
    });

    return false;
  }

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
      return undefined;
    }
  }

  const prevHasSystemPermission = hasSystemPermission;
  let finalValue: boolean | undefined;
  appNotificationStore.setState(state => {
    let { newVal } = resolveValFromUpdater(
      state.enabledTransactionNofification,
      valOrFunc,
      { strict: false },
    );
    if (!prevHasSystemPermission) newVal = true;

    void setPreferenceByKey(
      'enabledTransactionNofification',
      newVal,
    ).catch(console.error);
    finalValue = newVal;

    return { enabledTransactionNofification: newVal };
  });

  return finalValue;
}

export function useAppHasSystemNotificationPermission(): boolean | null {
  return appNotificationStore(s => s.hasSystemPermission);
}

export const useAppNotificationEnabled = () => {
  const enabledTransactionNofification = appNotificationStore(
    s => s.enabledTransactionNofification,
  );
  const hasSystemPermission = appNotificationStore(s => s.hasSystemPermission);

  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return {
      enabledTransactionNofification: false,
      hasSystemPermission: false,
      value: false,
      setValue: setEnableTransactionNofification,
    };
  }

  return {
    enabledTransactionNofification,
    hasSystemPermission,
    value: hasSystemPermission === true && enabledTransactionNofification,
    setValue: setEnableTransactionNofification,
  };
};
