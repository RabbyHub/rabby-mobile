import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { useAndroidPreventScreenshot } from './native/security';
import DeviceUtils from '@/core/utils/device';
import { atomByMMKV } from '@/core/storage/mmkv';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { autoLockEvent } from '@/core/apis/autoLock';
import { apisAutoLock } from '@/core/apis';

const isIOS = DeviceUtils.isIOS();

type ESettings = {
  androidAllowScreenCapture: boolean;
  iosAllowScreenRecord: boolean;
};
const ExperimentalSettingsAtom = atomByMMKV('ExperimentalSettings', {
  /**
   * @description means screen-capture/screen-recording on Android, or screen-recording on iOS
   *
   * for iOS, change it need restart the app
   */
  androidAllowScreenCapture: !__DEV__,
  iosAllowScreenRecord: !__DEV__,
});

const KEY = isIOS ? 'iosAllowScreenRecord' : 'androidAllowScreenCapture';
function isAllowScreenshot(ret: ESettings) {
  return ret[KEY];
}

export function useIsAllowScreenshot() {
  const [{ androidAllowScreenCapture, iosAllowScreenRecord }] = useAtom(
    ExperimentalSettingsAtom,
  );

  return {
    androidAllowScreenCapture,
    iosAllowScreenRecord,
    allowScreenshot: isAllowScreenshot({
      androidAllowScreenCapture,
      iosAllowScreenRecord,
    }),
  };
}

export function useAllowScreenshot() {
  const [result, setAtom] = useAtom(ExperimentalSettingsAtom);

  const setAllowScreenshot = useCallback(
    (valueOrFunc: boolean | ((prev: boolean) => boolean)) => {
      setAtom(prev => {
        const next =
          typeof valueOrFunc === 'function'
            ? valueOrFunc(prev[KEY])
            : valueOrFunc;

        return {
          ...prev,
          [KEY]: next,
        };
      });
    },
    [setAtom],
  );

  return {
    androidAllowScreenCapture: result.androidAllowScreenCapture,
    iosAllowScreenRecord: result.iosAllowScreenRecord,
    allowScreenshot: isAllowScreenshot(result),
    setAllowScreenshot,
  };
}

/**
 * @description call this hook only once on the top level of your app
 */
export function useGlobalAppPreventScreenshotOnDev() {
  const { allowScreenshot } = useIsAllowScreenshot();
  useAndroidPreventScreenshot(__DEV__ && !allowScreenshot);

  useEffect(() => {
    if (!isIOS && !__DEV__) return;

    if (!allowScreenshot) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [allowScreenshot]);
}

const autoLockTimeoutAtom = atom(-1);
autoLockTimeoutAtom.onMount = setter => {
  autoLockEvent.addListener('change', value => {
    setter(value);
  });
};

export function useAutoLockTimeout() {
  const [timeout, setTimeout] = useAtom(autoLockTimeoutAtom);

  const fetchTimeout = useCallback(() => {
    const value = apisAutoLock.getAutoLockTime();
    setTimeout(value);
    return value;
  }, [setTimeout]);

  return {
    autoLockTimeout: timeout,
    fetchTimeout,
  };
}
