import { APPLICATION_ID } from '@/constant';
import { getLatestNavigationName } from '@/utils/navigation';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
import { Platform } from 'react-native';
import DeviceInfo, { getManufacturerSync } from 'react-native-device-info';

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

// device基础信息：机型标识、系统、系统版本等
// 用户信息：地址、资产等
// 来源页面信息：来源页面、页面报错等
export function getScreenshotFeedbackExtra({
  totalBalanceText,
}: // addressList = [],
{
  totalBalanceText: string;
  // addressList: string[];
}): UserFeedbackItem['extra'] & object {
  // Implementation for collecting screenshot feedback
  return {
    totalBalanceText,
    currentScreen: getLatestNavigationName(),
    applicationId: APPLICATION_ID,

    fingerprint: runTryCatch(() => DeviceInfo.getFingerprintSync()),
    // addressList,
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

    ...(Platform.OS === 'android' && {
      androidId: runTryCatch(() => DeviceInfo.getAndroidId()),
      androidApiLevel: runTryCatch(() => DeviceInfo.getApiLevelSync()),
    }),

    userAgent: runTryCatch(() => DeviceInfo.getUserAgentSync()),
  };
}
