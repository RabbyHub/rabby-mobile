import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * iOS devices that expose a horizontal system control column. Add new ids here
 * once their letterboxed header geometry has been verified.
 */
export const FOLDABLE_IOS_DEVICE_IDS = ['iPhone19,4'];

/**
 * First iOS major version whose native header/JS header relationship was
 * measured for these devices. The foldable header compensation must be
 * re-verified before trusting it on a newer major release.
 */
export const FOLDABLE_IOS_MIN_MAJOR_VERSION = 27;

let cachedIsFoldableIosDevice: boolean | null = null;

/**
 * Device-id check, cached for the process lifetime. `DeviceInfo.getDeviceId()`
 * and `getModel()` read native constants synchronously; caching keeps
 * per-render layout hooks from repeating that lookup.
 */
export function isFoldableIosDevice() {
  if (cachedIsFoldableIosDevice !== null) {
    return cachedIsFoldableIosDevice;
  }

  cachedIsFoldableIosDevice = (() => {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      if (FOLDABLE_IOS_DEVICE_IDS.includes(DeviceInfo.getDeviceId())) {
        return true;
      }
      return /duo/i.test(DeviceInfo.getModel() || '');
    } catch {
      return false;
    }
  })();

  return cachedIsFoldableIosDevice;
}

/** iOS major version, e.g. 27 for "27.1". `null` when it cannot be parsed. */
export function getIosMajorVersion(): number | null {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const version = Platform.Version;
  const major =
    typeof version === 'number' ? version : parseInt(String(version), 10);

  return Number.isFinite(major) ? Math.trunc(major) : null;
}

/**
 * True only for a foldable iOS device whose current window is letterboxed to
 * the left of the system column: `right > 0` while the safe-area top is 0.
 *
 * The top check is what keeps iPad landscape/split windows (`top = 24`) and
 * every phone posture out of the foldable compensation.
 */
export function isFoldableSideColumnPosture(insets: {
  top: number;
  right: number;
}) {
  if (!isFoldableIosDevice() || insets.right <= 0 || insets.top > 0) {
    return false;
  }

  const major = getIosMajorVersion();

  return major === null || major >= FOLDABLE_IOS_MIN_MAJOR_VERSION;
}
