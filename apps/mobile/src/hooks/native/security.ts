import { useEffect } from 'react';
import { Alert } from 'react-native';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import DeviceUtils from '@/core/utils/device';
import { atom, useAtom } from 'jotai';

/**
 * @description Prevents the user from taking a screenshot,
 * call this hook on top of your App
 */
export function usePreventScreenshot(prevent = true) {
  useEffect(() => {
    if (!prevent) {
      RNScreenshotPrevent.togglePreventScreenshot(false);
      return;
    }

    RNScreenshotPrevent.togglePreventScreenshot(true);

    return () => {
      RNScreenshotPrevent.togglePreventScreenshot(false);
    };
  }, [prevent]);
}

export function useSubscribeUserTookScreenShotOnIOS() {
  useEffect(() => {
    if (!DeviceUtils.isIOS()) return;

    const { remove } = RNScreenshotPrevent.iosOnUserDidTakeScreenshot(() => {
      // alert user
      console.debug('User took screenshot');
      Alert.alert(
        'Screenshot taken',
        `You have taken a screenshot, notice data security.`,
      );
    });

    return () => {
      remove();
    };
  }, []);
}

const iosScreenIsCapturedAtom = atom(RNScreenshotPrevent.iosIsBeingCaptured());
export function useIOSScreenIsBeingCaptured() {
  const [isBeingCaptured] = useAtom(iosScreenIsCapturedAtom);

  return {
    isBeingCaptured,
  };
}
export function useIOSScreenCapture(options?: {
  isTop?: boolean;
  onIsBeingCapturedChanged?: (ctx: { isBeingCaptured: boolean }) => void;
}) {
  const [isBeingCaptured, setIsBeingCaptured] = useAtom(
    iosScreenIsCapturedAtom,
  );

  const { onIsBeingCapturedChanged, isTop } = options || {};

  useEffect(() => {
    if (!isTop) return;
    if (!DeviceUtils.isIOS()) return;

    const { remove } = RNScreenshotPrevent.iosOnScreenCaptureChanged(ctx => {
      setIsBeingCaptured(ctx.isBeingCaptured);
      onIsBeingCapturedChanged?.(ctx);
    });

    return () => {
      remove();
    };
  }, [isTop, setIsBeingCaptured, onIsBeingCapturedChanged]);

  return {
    isBeingCaptured,
  };
}
