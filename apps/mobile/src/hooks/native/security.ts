import { useCallback, useEffect } from 'react';
import { atom, useAtom } from 'jotai';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import '@/core/native/RNTimeChanged';
import { IS_IOS } from '@/core/native/utils';

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

const iosScreenCaptureAtom = atom({
  isBeingCaptured: IS_IOS ? RNScreenshotPrevent.iosIsBeingCaptured() : false,
  isScreenshotJustNow: false,
});

export function useIOSScreenIsBeingCaptured() {
  const [{ isBeingCaptured }] = useAtom(iosScreenCaptureAtom);

  return {
    isBeingCaptured,
  };
}

export function useIOSScreenRecording(options?: {
  isTop?: boolean;
  onIsBeingCapturedChanged?: (ctx: { isBeingCaptured: boolean }) => void;
}) {
  const [{ isBeingCaptured }, setIOSScreenCapture] =
    useAtom(iosScreenCaptureAtom);

  const { onIsBeingCapturedChanged, isTop } = options || {};

  useEffect(() => {
    if (!isTop) return;
    if (!IS_IOS) return;

    const { remove } = RNScreenshotPrevent.iosOnScreenCaptureChanged(ctx => {
      setIOSScreenCapture(prev => ({
        ...prev,
        isBeingCaptured: ctx.isBeingCaptured,
      }));
      onIsBeingCapturedChanged?.(ctx);
    });

    return () => {
      remove();
    };
  }, [isTop, setIOSScreenCapture, onIsBeingCapturedChanged]);

  return {
    isBeingCaptured,
  };
}

export function useIOSScreenshotted(options?: {
  isTop?: boolean;
  onIsScreenshottedJustNow?: (ctx: {
    setScreenshotted: (isScreenshotJustNow: boolean) => void;
  }) => void;
}) {
  const [{ isScreenshotJustNow }, setIOSScreenCapture] =
    useAtom(iosScreenCaptureAtom);

  const { onIsScreenshottedJustNow, isTop } = options || {};

  const clearScreenshotJustNow = useCallback(() => {
    setIOSScreenCapture(prev => ({ ...prev, isScreenshotJustNow: false }));
  }, [setIOSScreenCapture]);

  useEffect(() => {
    if (!IS_IOS) return;

    const { remove } = RNScreenshotPrevent.iosOnUserDidTakeScreenshot(() => {
      const setScreenshotted = (val?: boolean) =>
        setIOSScreenCapture(prev => ({ ...prev, isScreenshotJustNow: !!val }));
      onIsScreenshottedJustNow?.({ setScreenshotted });
    });

    return () => {
      remove();
    };
  }, [setIOSScreenCapture, onIsScreenshottedJustNow]);

  return {
    isScreenshotJustNow,
    clearScreenshotJustNow,
  };
}
