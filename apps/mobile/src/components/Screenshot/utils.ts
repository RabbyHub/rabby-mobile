import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { APP_VERSIONS, APPLICATION_ID } from '@/constant';
import { BUILD_GIT_INFO } from '@/constant/env';
import { getAllAccounts } from '@/core/apis/address';
import { getLatestNavigationName } from '@/utils/navigation';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
import { preferenceService } from '@/core/services';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  AccountSwitcherScene,
  SceneAccounts,
} from '@/hooks/sceneAccountInfoAtom';
import { appJsonStore } from '@/core/storage/mmkv';
import { apisPerps } from '@/core/apis';

function runTryCatch<T extends (...args: any[]) => any>(
  fn: T,
): ReturnType<T> | null {
  try {
    return fn();
  } catch (error) {
    console.error('Error occurred:', error);
    return null;
  }
}

export async function getSceneAddresses() {
  const zustandStore = appJsonStore.getItem('@SceneAccounts202512', {});

  const accounts = zustandStore.state as SceneAccounts;

  const values = Object.entries(accounts).reduce((acc, [key, value]) => {
    if (!key.startsWith('@')) {
      acc[key as AccountSwitcherScene] = value?.currentAccount?.address || null;
    }
    return acc;
  }, {} as { [K in AccountSwitcherScene]: string | null });

  const perpsInfo = await runTryCatch(
    async () => await apisPerps.getPerpsCurrentAccount(),
  );

  return {
    ...values,
    Perps: perpsInfo?.address || perpsInfo,
  };
}

const latestErrorsRef = {
  current: [] as { error: any; isFatal?: boolean; time: number }[],
};
/**
 * record latest 50 errors
 */
ErrorUtils.setGlobalHandler((error, isFatal) => {
  const list = latestErrorsRef.current || [];
  list.unshift({ error, isFatal, time: Date.now() });
  latestErrorsRef.current = list.sort((a, b) => b.time - a.time).slice(0, 50);
});

export async function getScreenshotFeedbackExtra({
  totalBalanceText,
}: {
  totalBalanceText: string;
}): Promise<UserFeedbackItem['extra'] & object> {
  const latestErrors = runTryCatch(() =>
    JSON.stringify(latestErrorsRef.current),
  );

  const appVersionText = APP_VERSIONS.forFeedback;
  const appVersion = APP_VERSIONS.fromNative;
  const appBuildNumber = APP_VERSIONS.buildNumber;
  const appBuildRevision = BUILD_GIT_INFO.BUILD_GIT_HASH;

  const myAccountList = await getAllAccounts();
  let myFirstCallableAddress = '';
  const {
    callables: myCallableAddressCount,
    uncallables: myUncallableAddressCount,
  } = myAccountList.reduce(
    (acc, item) => {
      if (
        item.type !== KEYRING_TYPE.WatchAddressKeyring &&
        item.type !== KEYRING_TYPE.GnosisKeyring
      ) {
        myFirstCallableAddress = myFirstCallableAddress || item.address;
        acc.callables += 1;
      } else {
        acc.uncallables += 1;
      }
      return acc;
    },
    { callables: 0, uncallables: 0 },
  );
  const myCurrentAddress = preferenceService.getFallbackAccount()?.address;

  return {
    totalBalanceText,
    currentScreen: getLatestNavigationName(),
    appVersionText,
    appVersion,
    appBuildNumber,
    appBuildRevision,
    applicationId: APPLICATION_ID,
    myCallableAddressCount,
    myUncallableAddressCount,
    myFirstAddress: myFirstCallableAddress,
    myCurrentAddress,
    mySceneAddresses: await runTryCatch(async () => await getSceneAddresses()),

    systemName: runTryCatch(() => DeviceInfo.getSystemName()),
    systemVersion: runTryCatch(() => DeviceInfo.getSystemVersion()),
    deviceModel: runTryCatch(() => DeviceInfo.getModel()),
    deviceId: runTryCatch(() => DeviceInfo.getDeviceId()),
    deviceType: runTryCatch(() => DeviceInfo.getDeviceType()),
    manufacturer: runTryCatch(() => DeviceInfo.getManufacturerSync()),

    isLandscape: runTryCatch(() => DeviceInfo.isLandscapeSync()),
    isTablet: runTryCatch(() => DeviceInfo.isTablet()),
    isLowRamDevice: runTryCatch(() => DeviceInfo.isLowRamDevice()),
    isDisplayZoomed: runTryCatch(() => DeviceInfo.isDisplayZoomed()),
    isAirplaneMode: runTryCatch(() => DeviceInfo.isAirplaneModeSync()),

    ...(Platform.OS === 'android' && {
      androidId: runTryCatch(() => DeviceInfo.getAndroidId()),
      androidApiLevel: runTryCatch(() => DeviceInfo.getApiLevelSync()),
    }),

    userAgent: runTryCatch(() => DeviceInfo.getUserAgentSync()),
    fontScale: runTryCatch(() => DeviceInfo.getFontScaleSync()),

    latestErrors,
  };
}
