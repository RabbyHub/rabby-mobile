import { useCallback, useEffect, useMemo, useState } from 'react';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import '@/core/native/RNTimeChanged';
import { IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

const globalScreenCapturableRef = { current: true };
export function getGlobalScreenCapturable() {
  return globalScreenCapturableRef.current;
}
/**
 * @description Prevents the user from taking a screenshot,
 * call this hook on top of your App
 */
export function usePreventScreenshot(prevent = true, { isTop = false } = {}) {
  useEffect(() => {
    if (!isTop) {
      console.warn('usePreventScreenshot is not on top');
      return;
    }

    globalScreenCapturableRef.current = !prevent;
    if (!prevent) {
      RNScreenshotPrevent.togglePreventScreenshot(false);
      return;
    }

    RNScreenshotPrevent.togglePreventScreenshot(true);

    return () => {
      RNScreenshotPrevent.togglePreventScreenshot(false);
    };
  }, [prevent, isTop]);
}

type IosScreenCaptureState = {
  isBeingCaptured: boolean;
  isScreenshotJustNow: boolean;
};
const iosScreenCaptureStore = zCreate<IosScreenCaptureState>(() => ({
  isBeingCaptured: IS_IOS ? RNScreenshotPrevent.iosIsBeingCaptured() : false,
  isScreenshotJustNow: false,
}));

function setIOSScreenCapture(
  valOrFunc: UpdaterOrPartials<IosScreenCaptureState>,
) {
  iosScreenCaptureStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });
    if (!changed) return prev;

    return { ...prev, ...newVal };
  });
}

export function useIOSScreenIsBeingCaptured() {
  const isBeingCaptured = iosScreenCaptureStore(s => s.isBeingCaptured);

  return {
    isBeingCaptured,
  };
}

export function useIOSScreenRecording(options?: {
  isTop?: boolean;
  onIsBeingCapturedChanged?: (ctx: { isBeingCaptured: boolean }) => void;
}) {
  const isBeingCaptured = iosScreenCaptureStore(s => s.isBeingCaptured);

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
  }, [isTop, onIsBeingCapturedChanged]);

  return {
    isBeingCaptured,
  };
}

const clearScreenshotJustNow = () => {
  setIOSScreenCapture(prev => ({ ...prev, isScreenshotJustNow: false }));
};

export function useIOSScreenshotted(options?: {
  isTop?: boolean;
  onIsScreenshottedJustNow?: (ctx: {
    setScreenshotted: (isScreenshotJustNow: boolean) => void;
  }) => void;
}) {
  const isScreenshotJustNow = iosScreenCaptureStore(s => s.isScreenshotJustNow);

  const { onIsScreenshottedJustNow, isTop } = options || {};

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
  }, [onIsScreenshottedJustNow]);

  return {
    isScreenshotJustNow,
    clearScreenshotJustNow,
  };
}
