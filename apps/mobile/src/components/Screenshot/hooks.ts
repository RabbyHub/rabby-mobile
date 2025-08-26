import { useCallback, useEffect, useMemo } from 'react';
import {
  Dimensions,
  Image,
  ImageResolvedAssetSource,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import { atom, useAtom } from 'jotai';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { openapi } from '@/core/request';
import { AppScreenshotFS, appScreenshotFS } from '@/core/storage/fs';
import { coerceNumber } from '@/utils/coerce';
import { stringUtils } from '@rabby-wallet/base-utils';

const lastScreenShotAtom = atom<ImageResolvedAssetSource | null>(null);
export function useLastScreenshot() {
  const [lastScreenshot, setLastScreenshot] = useAtom(lastScreenShotAtom);

  return { lastScreenshot, setLastScreenshot };
}
export function useResize(
  orig?: null | { height?: number; width?: number },
  {
    maxWidth = Dimensions.get('window').width - 20,
    maxHeight,
  }: { maxWidth?: number; maxHeight?: number } = {},
) {
  const scaledSize = useMemo(() => {
    const shaped = {
      height: coerceNumber(orig?.height, 100),
      width: coerceNumber(orig?.width, 100),
    };

    const aspectRatio = coerceNumber(
      maxHeight ? shaped.height / maxHeight : shaped.width / maxWidth,
      1,
    );

    return {
      height: Math.floor(shaped.height / aspectRatio),
      width: Math.floor(shaped.width / aspectRatio),
    };
  }, [orig, maxWidth, maxHeight]);

  return { scaledSize };
}
export function useUserDidTakeScreenshot({
  isTop = false,
}: {
  isTop?: boolean;
} = {}) {
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
          if (!inAppPath) return;
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
          if (!inAppPath) return;
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
  }, [isTop, setLastScreenshot]);
}

export const SCREENSHOT_FEEDBACK_MAX_LENGTH = 301;
const submitFeedbackOnScreenshotAtom = atom({
  modalShown: __DEV__,
  feedbackText: '',
});

export function useFeedbackOnScreenshot() {
  const [submitFeedbackOnScreenshot, setSubmitFeedbackOnScreenshot] = useAtom(
    submitFeedbackOnScreenshotAtom,
  );
  const onChangeFeedback = useCallback(
    (feedback: string) => {
      setSubmitFeedbackOnScreenshot(prev => ({
        ...prev,
        feedbackText: feedback.slice(0, SCREENSHOT_FEEDBACK_MAX_LENGTH), // Limit feedback to 1000 characters
      }));
    },
    [setSubmitFeedbackOnScreenshot],
  );

  return {
    globalModalShown: submitFeedbackOnScreenshot.modalShown,
    feedbackText: submitFeedbackOnScreenshot.feedbackText,
    feedbackOverLimit:
      submitFeedbackOnScreenshot.feedbackText.length >
      SCREENSHOT_FEEDBACK_MAX_LENGTH - 1,
    onChangeFeedback,
  };
}
export function useSubmitFeedbackOnScreenshot() {
  const [submitFeedbackOnScreenshot, setSubmitFeedbackOnScreenshot] = useAtom(
    submitFeedbackOnScreenshotAtom,
  );
  const { globalModalShown, feedbackText } = useFeedbackOnScreenshot();
  const { lastScreenshot } = useLastScreenshot();

  const submitFeedback = useCallback(
    async function () {
      if (!lastScreenshot?.uri) {
        throw new Error('No screenshot available');
      }

      const result = await AppScreenshotFS.uploadFile<{ image_url: string }>(
        lastScreenshot?.uri,
      );

      if (result?.image_url) {
        const submitResult = await openapi.postUserFeedback({
          title: '',
          image_url_list: [result.image_url],
          content: feedbackText,
        });
      }
    },
    [feedbackText, lastScreenshot?.uri],
  );

  return {
    globalModalShown,
    feedbackText,

    submitFeedback,

    canSubmit: !!lastScreenshot?.uri && feedbackText.length > 0,
  };
}
