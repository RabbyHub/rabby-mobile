import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { APP_VERSIONS, APPLICATION_ID } from '@/constant';
import { BUILD_GIT_INFO } from '@/constant/env';
import { getAllMyAccount } from '@/core/apis/address';
import { getLatestNavigationName } from '@/utils/navigation';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
import { preferenceService } from '@/core/services';

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
  // Implementation for collecting screenshot feedback

  const latestErrors = runTryCatch(() =>
    JSON.stringify(latestErrorsRef.current),
  );

  const appVersionText = APP_VERSIONS.forFeedback;
  const appVersion = APP_VERSIONS.fromNative;
  const appBuildNumber = APP_VERSIONS.buildNumber;
  const appBuildRevision = BUILD_GIT_INFO.BUILD_GIT_HASH;

  const myAccountList = await getAllMyAccount();
  const myAddressList = myAccountList.map(acc => acc.address);
  const currentAddress = preferenceService.getFallbackAccount()?.address;

  return {
    totalBalanceText,
    currentScreen: getLatestNavigationName(),
    appVersionText,
    appVersion,
    appBuildNumber,
    appBuildRevision,
    applicationId: APPLICATION_ID,
    myAddressList,
    currentAddress,

    systemName: runTryCatch(() => DeviceInfo.getSystemName()),
    systemVersion: runTryCatch(() => DeviceInfo.getSystemVersion()),
    deviceModel: runTryCatch(() => DeviceInfo.getModel()),
    deviceId: runTryCatch(() => DeviceInfo.getDeviceId()),
    deviceType: runTryCatch(() => DeviceInfo.getDeviceType()),
    manufacturer: runTryCatch(() => DeviceInfo.getManufacturerSync()),

    isLandscape: runTryCatch(() => DeviceInfo.isLandscapeSync()),
    isLandscapeSync: runTryCatch(() => DeviceInfo.isLandscapeSync()),
    isTablet: runTryCatch(() => DeviceInfo.isTablet()),
    isLowRamDevice: runTryCatch(() => DeviceInfo.isLowRamDevice()),
    isDisplayZoomed: runTryCatch(() => DeviceInfo.isDisplayZoomed()),
    isAirplaneMode: runTryCatch(() => DeviceInfo.isAirplaneModeSync()),

    ...(Platform.OS === 'android' && {
      androidId: runTryCatch(() => DeviceInfo.getAndroidId()),
      androidApiLevel: runTryCatch(() => DeviceInfo.getApiLevelSync()),
    }),

    userAgent: runTryCatch(() => DeviceInfo.getUserAgentSync()),

    latestErrors,
  };
}
