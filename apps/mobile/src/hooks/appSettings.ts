import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { usePreventScreenshot } from './native/security';
import DeviceUtils from '@/core/utils/device';
import { atomByMMKV } from '@/core/storage/mmkv';
import useMount from 'react-use/lib/useMount';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';

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
  androidAllowScreenCapture: !!__DEV__,
  iosAllowScreenRecord: false,
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
export function useAppPreventScreenshot() {
  const { allowScreenshot } = useIsAllowScreenshot();
  usePreventScreenshot(!allowScreenshot);

  useEffect(() => {
    if (!isIOS) return;

    if (!allowScreenshot) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [allowScreenshot]);
}
