import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

function safeGet<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (error) {
    console.error('[deviceInfo] Failed to collect device info:', error);
    return null;
  }
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function uniqueNonEmptyStrings(values: unknown[]) {
  const seen = new Set<string>();

  return values.reduce<string[]>((acc, value) => {
    const text = toNonEmptyString(value);
    const key = text?.toLowerCase();

    if (!text || !key || seen.has(key)) {
      return acc;
    }

    seen.add(key);
    acc.push(text);
    return acc;
  }, []);
}

export function getDeviceInfoForFeedbackText() {
  const manufacturer = safeGet(() => DeviceInfo.getManufacturerSync());
  const model = safeGet(() => DeviceInfo.getModel());
  const deviceId = safeGet(() => DeviceInfo.getDeviceId());
  const systemName = safeGet(() => DeviceInfo.getSystemName());
  const systemVersion = safeGet(() => DeviceInfo.getSystemVersion());
  const androidApiLevel =
    Platform.OS === 'android'
      ? safeGet(() => DeviceInfo.getApiLevelSync())
      : null;

  const deviceName = uniqueNonEmptyStrings([manufacturer, model]).join(' ');
  const deviceCode = toNonEmptyString(deviceId);
  const deviceText =
    [deviceName, deviceCode ? `(${deviceCode})` : null]
      .filter(Boolean)
      .join(' ') || Platform.OS;

  const osText =
    [
      uniqueNonEmptyStrings([systemName, systemVersion]).join(' '),
      androidApiLevel ? `(API ${androidApiLevel})` : null,
    ]
      .filter(Boolean)
      .join(' ') || Platform.OS;

  return {
    deviceText,
    osText,
  };
}
