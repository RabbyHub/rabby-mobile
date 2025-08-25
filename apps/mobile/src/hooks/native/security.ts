import { useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useAtom } from 'jotai';
import {
  Dimensions,
  Image,
  ImageResolvedAssetSource,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import '@/core/native/RNTimeChanged';
import { IS_IOS } from '@/core/native/utils';
import { coerceNumber } from '@/utils/coerce';
import { stringUtils } from '@rabby-wallet/base-utils';
import { appScreenshotFS } from '@/core/storage/fs';

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

const lastScreenShotAtom = atom<ImageResolvedAssetSource | null>(null);
export function useLastScreenshot() {
  const [lastScreenshot, setLastScreenshot] = useAtom(lastScreenShotAtom);

  return { lastScreenshot, setLastScreenshot };
}
export function useResize(
  orig?: null | { height?: number; width?: number },
  {
    maxWidth = Dimensions.get('window').width - 20,
  }: { maxWidth?: number } = {},
) {
  const scaledSize = useMemo(() => {
    const shaped = {
      height: coerceNumber(orig?.height, 100),
      width: coerceNumber(orig?.width, 100),
    };

    const aspectRatio = shaped.width / maxWidth;

    return {
      height: Math.floor(shaped.height / aspectRatio),
      width: Math.floor(shaped.width / aspectRatio),
    };
  }, [orig, maxWidth]);

  return { scaledSize };
}
export function useUserDidTakeScreenshot({
  isTop = false,
}: {
  isTop?: boolean;
} = {}) {
  const [, setIOSScreenCapture] = useAtom(iosScreenCaptureAtom);
  const { setLastScreenshot } = useLastScreenshot();

  useEffect(() => {
    if (!isTop) return;

    // For Android, check if we should use Android 14+ screen capture detection
    const androidVersion = Platform.Version as number;

    // Listen for screen capture detection events on Android 14+
    const cbs = {
      screenCaptureChangedListener: null as { remove: () => void } | null,
      screenCaptureStoppedListener: null as { remove: () => void } | null,
    };
    if (androidVersion >= 34) {
      RNScreenshotPrevent.startScreenCaptureDetection();
      cbs.screenCaptureChangedListener =
        RNScreenshotPrevent.onScreenCaptureDetectionChanged(params => {
          console.debug(
            '[debug] Using Android 14+ screen capture detection changed',
            params,
          );
        });
    }

    const { remove } = RNScreenshotPrevent.onUserDidTakeScreenshot(
      async params => {
        // console.debug('[feat] userDidTakeScreenshot event received:', params);
        // You can add custom logic here to handle screenshot events
        // For example, show a notification or log the event
        // const imageType = params?.imageType || 'jpeg';
        const sizes = {
          height: coerceNumber(params?.height, 100),
          width: coerceNumber(params?.width, 100),
        };
        const fullPath = params?.path
          ? stringUtils.ensurePrefix(params.path, 'file://')
          : '';

        if (fullPath && (await RNFS.exists(fullPath))) {
          const inAppPath = await appScreenshotFS.saveScreenshotFrom(fullPath);
          const image = Image.resolveAssetSource({
            uri: inAppPath,
            height: sizes.height,
            width: sizes.width,
          });
          setLastScreenshot(image);
        } else if (params?.imageBase64) {
          const inAppPath = await appScreenshotFS.saveScreenshotFrom(
            params.imageBase64,
            { fallbackAsBase64: true },
          );
          const image = Image.resolveAssetSource({
            uri: inAppPath,
            height: sizes.height,
            width: sizes.width,
          });
          setLastScreenshot(image);
        }
      },
    );

    return () => {
      // Stop appropriate screenshot detection based on platform and Android version
      if (androidVersion >= 34) {
        // Android 14+ - stop screen capture detection
        RNScreenshotPrevent.stopScreenCaptureDetection();
      }

      remove();

      // Remove screen capture detection listeners
      cbs.screenCaptureChangedListener?.remove();
      cbs.screenCaptureStoppedListener?.remove();
    };
  }, [isTop, setLastScreenshot, setIOSScreenCapture]);
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

    const { remove } = RNScreenshotPrevent.onUserDidTakeScreenshot(() => {
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
