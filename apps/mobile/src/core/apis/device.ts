import { APP_VERSIONS, APPLICATION_ID } from '@/constant';
import { BUILD_GIT_INFO } from '@/constant/env';

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { v4 as uuidv4 } from 'uuid';
import { appJsonStore } from '../storage/mmkv';

type MobileClientInfo = {
  deviceUUID: string;

  platform: 'android' | 'ios';
  packageName: string;
  systemVersion: string;
  systemName: string;

  appVersion: string;
  appBuildNumber: string;
  appBuildRevision: string;

  enabledNotifications: boolean;
};

export function ensureDeviceUUID(): string {
  let devUUID = appJsonStore.getItem('rabbymobile_uuid', null);
  if (!devUUID) {
    devUUID = uuidv4();
    appJsonStore.setItem('rabbymobile_uuid', devUUID);
  }
  return devUUID;
}

type MobileClientPushInfo = MobileClientInfo & {
  pushToken: string;
};

export function makeMobileClientPushInfo(
  pushToken: string,
  enabledNotifications: boolean,
): MobileClientPushInfo {
  const appVersion = APP_VERSIONS.fromNative;
  const appBuildNumber = APP_VERSIONS.buildNumber;
  const appBuildRevision = BUILD_GIT_INFO.BUILD_GIT_HASH;

  const uniqId = DeviceInfo.getUniqueIdSync();
  const deviceUUID = `${ensureDeviceUUID()}-${Platform.OS}-${uniqId}`;

  return {
    // TODO: generate uuid and persisted
    deviceUUID: __DEV__ ? deviceUUID : deviceUUID,

    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    packageName: APPLICATION_ID,
    systemVersion: DeviceInfo.getSystemVersion(),
    systemName: DeviceInfo.getSystemName(),

    appVersion,
    appBuildNumber,
    appBuildRevision,

    enabledNotifications,

    pushToken,
  };
}
