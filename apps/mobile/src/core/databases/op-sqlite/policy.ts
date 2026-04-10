import { getRabbyAppDbDir } from '@/databases/constant';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';

const FORCE_MEMORY_TEMP_STORE_UNTIL_ANDROID_API_LEVEL = 32;

const FORCE_MEMORY_ANDROID_DEVICE_IDS = new Set<string>([]);
const KEEP_DEFAULT_ANDROID_DEVICE_IDS = new Set<string>([]);

const safeGet = <T>(getValue: () => T, fallback: T): T => {
  try {
    return getValue();
  } catch {
    return fallback;
  }
};

const normalizeDeviceId = (deviceId: string | null | undefined) => {
  return (deviceId || '').trim().toLowerCase();
};

export type SQLiteConnectionTempStorePolicy = {
  platform: 'android';
  targetTempStore: 'default' | 'memory';
  shouldApplyMemoryPragma: boolean;
  reason: string;
  androidApiLevel: number | null;
  systemVersion: string | null;
  manufacturer: string | null;
  model: string | null;
  deviceId: string | null;
  appDbDirectory: string | null;
  candidateTempDirectory: string | null;
};

export function formatSQLiteTempStoreValue(value: number | null | undefined) {
  switch (value) {
    case 0:
      return 'DEFAULT';
    case 1:
      return 'FILE';
    case 2:
      return 'MEMORY';
    default:
      return 'UNKNOWN';
  }
}

export function shouldResolveSQLiteConnectionTempStorePolicy() {
  return Platform.OS === 'android';
}

export function resolveSQLiteConnectionTempStorePolicy(): SQLiteConnectionTempStorePolicy | null {
  if (!shouldResolveSQLiteConnectionTempStorePolicy()) {
    return null;
  }

  const appDbDirectory = getRabbyAppDbDir();
  const candidateTempDirectory =
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || null;

  const androidApiLevel = safeGet(() => DeviceInfo.getApiLevelSync(), null);
  const systemVersion = safeGet(() => DeviceInfo.getSystemVersion(), null);
  const manufacturer = safeGet(() => DeviceInfo.getManufacturerSync(), null);
  const model = safeGet(() => DeviceInfo.getModel(), null);
  const deviceId = safeGet(() => DeviceInfo.getDeviceId(), null);
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  if (
    normalizedDeviceId &&
    KEEP_DEFAULT_ANDROID_DEVICE_IDS.has(normalizedDeviceId)
  ) {
    return {
      platform: 'android',
      targetTempStore: 'default',
      shouldApplyMemoryPragma: false,
      reason: `${deviceId} is in the keep-default override list.`,
      androidApiLevel,
      systemVersion,
      manufacturer,
      model,
      deviceId,
      appDbDirectory,
      candidateTempDirectory,
    };
  }

  if (
    normalizedDeviceId &&
    FORCE_MEMORY_ANDROID_DEVICE_IDS.has(normalizedDeviceId)
  ) {
    return {
      platform: 'android',
      targetTempStore: 'memory',
      shouldApplyMemoryPragma: true,
      reason: `${deviceId} is in the force-memory override list.`,
      androidApiLevel,
      systemVersion,
      manufacturer,
      model,
      deviceId,
      appDbDirectory,
      candidateTempDirectory,
    };
  }

  if (
    typeof androidApiLevel === 'number' &&
    androidApiLevel <= FORCE_MEMORY_TEMP_STORE_UNTIL_ANDROID_API_LEVEL
  ) {
    return {
      platform: 'android',
      targetTempStore: 'memory',
      shouldApplyMemoryPragma: true,
      reason: `Android API ${androidApiLevel} is within the current mitigation range (<= ${FORCE_MEMORY_TEMP_STORE_UNTIL_ANDROID_API_LEVEL}).`,
      androidApiLevel,
      systemVersion,
      manufacturer,
      model,
      deviceId,
      appDbDirectory,
      candidateTempDirectory,
    };
  }

  return {
    platform: 'android',
    targetTempStore: 'default',
    shouldApplyMemoryPragma: false,
    reason:
      typeof androidApiLevel === 'number'
        ? `Android API ${androidApiLevel} is outside the current mitigation range.`
        : 'Android API level is unavailable, keep the default temp_store policy.',
    androidApiLevel,
    systemVersion,
    manufacturer,
    model,
    deviceId,
    appDbDirectory,
    candidateTempDirectory,
  };
}
