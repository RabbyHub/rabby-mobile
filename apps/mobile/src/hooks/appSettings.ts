import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { usePreventScreenshot } from './native/security';
import DeviceUtils from '@/core/utils/device';
import { atomByMMKV } from '@/core/storage/mmkv';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { apisAutoLock } from '@/core/apis';
import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { preferenceService } from '@/core/services';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';
import { isNonPublicProductionEnv } from '@/constant/env';

const isIOS = DeviceUtils.isIOS();

type ScreenshotSettings = {
  androidForceAllowScreenCapture: boolean;
  iosForceAllowScreenRecord: boolean;
};
const ExperimentalSettingsAtom = atomByMMKV('@ExperimentalSettings', {
  /**
   * @description means screen-capture/screen-recording on Android, or screen-recording on iOS
   *
   * for iOS, change it need restart the app
   */
  androidForceAllowScreenCapture: false,
  iosForceAllowScreenRecord: false,
});

const KEY = isIOS
  ? 'iosForceAllowScreenRecord'
  : 'androidForceAllowScreenCapture';
function isAllowScreenshot(ret: ScreenshotSettings) {
  return ret[KEY];
}

export function useIsForceAllowScreenshot() {
  const [{ androidForceAllowScreenCapture, iosForceAllowScreenRecord }] =
    useAtom(ExperimentalSettingsAtom);

  if (!isNonPublicProductionEnv) {
    return {
      androidForceAllowScreenCapture: false,
      iosForceAllowScreenRecord: false,
      forceAllowScreenshot: false,
    };
  }

  return {
    androidForceAllowScreenCapture,
    iosForceAllowScreenRecord,
    forceAllowScreenshot: isAllowScreenshot({
      androidForceAllowScreenCapture,
      iosForceAllowScreenRecord,
    }),
  };
}

export function useForceAllowScreenshot() {
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
    androidForceAllowScreenCapture: result.androidForceAllowScreenCapture,
    iosForceAllowScreenRecord: result.iosForceAllowScreenRecord,
    forceAllowScreenshot: isAllowScreenshot(result),
    setAllowScreenshot,
  };
}

/**
 * @description call this hook only once on the top level of your app
 */
export function useGlobalAppPreventScreenrecordOnDev() {
  const { forceAllowScreenshot } = useIsForceAllowScreenshot();
  usePreventScreenshot(__DEV__ && !forceAllowScreenshot);

  useEffect(() => {
    if (!isIOS || !__DEV__) return;

    if (!forceAllowScreenshot) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  }, [forceAllowScreenshot]);
}

const autoLockMinutesAtom = atom<number>(DEFAULT_AUTO_LOCK_MINUTES);
autoLockMinutesAtom.onMount = setAutoLockMinutes => {
  const times = apisAutoLock.getPersistedAutoLockTimes();
  setAutoLockMinutes(times.minutes);
};
export function useAutoLockTimeMinites() {
  const [autoLockMinutes, setAutoLockMinutes] = useAtom(autoLockMinutesAtom);

  return { autoLockMinutes };
}
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

const showFloatingViewAtom = atom({
  collapsed: true,
  ui_showAutoLockCountdown: false,
});

export function useFloatingView() {
  const [floatingView, setShowFloatingView] = useAtom(showFloatingViewAtom);
  const toggleCollapsed = useCallback(
    (nextEnabled?: boolean) => {
      setShowFloatingView(prev => {
        if (typeof nextEnabled !== 'boolean') {
          nextEnabled = !prev.collapsed;
        }
        return {
          ...prev,
          collapsed: nextEnabled,
        };
      });
    },
    [setShowFloatingView],
  );

  return {
    collapsed: floatingView.collapsed,
    toggleCollapsed,
    shouldShow: Object.entries(floatingView).some(
      ([k, v]) => k.startsWith('ui_') && v,
    ),
  };
}

export function useToggleShowAutoLockCountdown() {
  const [floatingView, setShowFloatingView] = useAtom(showFloatingViewAtom);

  const toggleShowAutoLockCountdown = useCallback(
    (nextEnabled?: boolean) => {
      setShowFloatingView(prev => {
        if (typeof nextEnabled !== 'boolean') {
          nextEnabled = !prev.ui_showAutoLockCountdown;
        }
        return {
          ...prev,
          ui_showAutoLockCountdown: nextEnabled,
        };
      });
    },
    [setShowFloatingView],
  );

  return {
    showAutoLockCountdown: floatingView.ui_showAutoLockCountdown,
    toggleShowAutoLockCountdown,
  };
}
