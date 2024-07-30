import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { usePreventScreenshot } from './native/security';
import DeviceUtils from '@/core/utils/device';
import { atomByMMKV } from '@/core/storage/mmkv';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { apisAutoLock } from '@/core/apis';
import { DEFAULT_AUTO_LOCK_MINUTES, TIME_SETTINGS } from '@/constant/autoLock';
import { preferenceService } from '@/core/services';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';

const isIOS = DeviceUtils.isIOS();

type ESettings = {
  androidAllowScreenCapture: boolean;
  iosAllowScreenRecord: boolean;
};
const ExperimentalSettingsAtom = atomByMMKV('@ExperimentalSettings', {
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
export function useGlobalAppPreventScreenrecordOnDev() {
  const { allowScreenshot } = useIsAllowScreenshot();
  usePreventScreenshot(__DEV__ && !allowScreenshot);

  useEffect(() => {
    if (!isIOS && !__DEV__) return;

    if (!allowScreenshot) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [allowScreenshot]);
}

const autoLockMinutesAtom = atom<number>(DEFAULT_AUTO_LOCK_MINUTES);
autoLockMinutesAtom.onMount = setAutoLockMinutes => {
  const times = apisAutoLock.getPersistedAutoLockTimes();
  setAutoLockMinutes(times.minutes);
};
export function useAutoLockTimeMs() {
  const [autoLockMinutes, setAutoLockMinutes] = useAtom(autoLockMinutesAtom);

  const autoLockMs = useMemo(
    () => autoLockMinutes * 60 * 1000,
    [autoLockMinutes],
  );

  const onAutoLockTimeMsChange = useCallback(
    (ms: number) => {
      const minutes = apisAutoLock.coerceAutoLockTimeout(ms).minutes;
      setAutoLockMinutes(minutes);
      preferenceService.setPreference({
        autoLockTime: minutes,
      });
      apisAutoLock.refreshAutolockTimeout();
    },
    [setAutoLockMinutes],
  );

  return {
    autoLockMs,
    // autoLockMinutes,
    onAutoLockTimeMsChange,
  };
}

export function useCurrentAutoLockLabel() {
  const autoLockMinutes = useAtomValue(autoLockMinutesAtom);

  return useMemo(() => {
    const minutes = autoLockMinutes;

    const preset = TIME_SETTINGS.find(
      setting => setting.milliseconds === minutes * 60 * 1000,
    );
    if (preset?.label) return preset?.label;

    const timeSpans = getTimeSpan(minutes);

    return [
      timeSpans.d ? `${timeSpans.d} Day(s)` : '',
      timeSpans.h ? `${timeSpans.h} Hour(s)` : '',
      timeSpans.m ? `${timeSpans.m} Minute(s)` : '',
      // timeSpans.s ? `${timeSpans.s} Sec(s)` : '',
    ].join(' ');
  }, [autoLockMinutes]);
}
