import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { atomByMMKV } from '@/core/storage/mmkv';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
import { useAtomCallback } from 'jotai/utils';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { toast } from '@/components2024/Toast';

type LocalUserFeedbackItem = Pick<UserFeedbackItem, 'id' | 'create_at'>;
const screenshotFeedbackssAtom = atomByMMKV('@screenshotFeedbackIds', {
  feedbacks: [] as LocalUserFeedbackItem[],
});

export function sortFeedbackItemByCreateAtDesc(
  a: LocalUserFeedbackItem,
  b: LocalUserFeedbackItem,
) {
  return b.create_at - a.create_at;
}
export const LATEST_LOCAL_FEEDBACK_LIMIT = 10;
function useScreenshotFeedbacks() {
  const [, setScreenshotFeedbacks] = useAtom(screenshotFeedbackssAtom);

  const onFeedbackSubmitted = useCallback(
    (idOrItem: LocalUserFeedbackItem) => {
      setScreenshotFeedbacks(prev => {
        const list = prev.feedbacks;

        const newFeedback = {
          id: idOrItem.id,
          create_at: idOrItem.create_at || Date.now(),
        };
        list.push(newFeedback);
        // order by timestamp desc
        list.sort(sortFeedbackItemByCreateAtDesc);

        return {
          ...prev,
          feedbacks: Array.from(list).slice(0, LATEST_LOCAL_FEEDBACK_LIMIT),
        };
      });
    },
    [setScreenshotFeedbacks],
  );

  const clearFeedbacks = useCallback(() => {
    setScreenshotFeedbacks({ feedbacks: [] });
  }, [setScreenshotFeedbacks]);

  const removeLocalFeedback = useCallback(
    (id: string) => {
      setScreenshotFeedbacks(prev => {
        const list = prev.feedbacks.filter(item => item.id !== id);
        return {
          ...prev,
          feedbacks: Array.from(list).slice(0, LATEST_LOCAL_FEEDBACK_LIMIT),
        };
      });
    },
    [setScreenshotFeedbacks],
  );

  return {
    onFeedbackSubmitted,
    clearFeedbacks,
    removeLocalFeedback,
  };
}

export function useLatestRepliedFeedbacks() {
  const [screenshotFeedbacks] = useAtom(screenshotFeedbackssAtom);

  const { localFeedbacks } = useMemo(() => {
    const feedbacks = screenshotFeedbacks.feedbacks.sort(
      sortFeedbackItemByCreateAtDesc,
    );

    return {
      localFeedbacks: feedbacks.slice(0, LATEST_LOCAL_FEEDBACK_LIMIT),
    };
  }, [screenshotFeedbacks]);

  const [{ value: lastRepliedFeedback, loading, error }, loadFeedbacks] =
    useAsyncFn(async () => {
      if (!localFeedbacks.length) return;

      const rtFeedbacks = await openapi.getUserFeedbackList(
        localFeedbacks.map(localFeedback => localFeedback.id),
      );

      // console.debug('[debug] rtFeedbacks', rtFeedbacks);

      const latestReplied = rtFeedbacks
        .filter(item => item.status === 'complete')
        .sort(sortFeedbackItemByCreateAtDesc)
        .at(0);

      return latestReplied;
    }, [localFeedbacks]);

  useEffect(() => {
    loadFeedbacks();

    const timer = setInterval(
      () => {
        loadFeedbacks();
      },
      __DEV__ ? 5 * 1e3 : 30 * 1e3,
    );

    return () => {
      clearInterval(timer);
    };
  }, [loadFeedbacks]);

  return { lastRepliedFeedback, loading, error };
}

function getDefaultValue() {
  return {
    lastScreenshot: null,
    submitModalShown: false,
    feedbackText: '',
    submitSuccessModalShown: false,

    viewingFeedback: null,
  };
}
export const SCREENSHOT_FEEDBACK_MAX_LENGTH = 301;
const feedbackByScreenshotAtom = atom<{
  lastScreenshot: ImageResolvedAssetSource | null;
  submitModalShown: boolean;
  feedbackText: string;
  submitSuccessModalShown: boolean;

  viewingFeedback: UserFeedbackItem | null;
}>(getDefaultValue());

export function useViewingFeedback() {
  const [feedbackByScreenshot, setFeedbackByScreenshot] = useAtom(
    feedbackByScreenshotAtom,
  );

  const startViewingFeedback = useCallback(
    (feedback: UserFeedbackItem) => {
      setFeedbackByScreenshot(prev => ({
        ...prev,
        viewingFeedback: feedback,
      }));
    },
    [setFeedbackByScreenshot],
  );

  const { removeLocalFeedback } = useScreenshotFeedbacks();

  const finishViewFeedback = useCallback(() => {
    if (feedbackByScreenshot.viewingFeedback) {
      removeLocalFeedback(feedbackByScreenshot.viewingFeedback?.id);
    }
    setFeedbackByScreenshot(prev => ({
      ...prev,
      viewingFeedback: null,
    }));
  }, [
    removeLocalFeedback,
    setFeedbackByScreenshot,
    feedbackByScreenshot.viewingFeedback,
  ]);

  return {
    viewingFeedback: feedbackByScreenshot.viewingFeedback,
    startViewingFeedback,
    finishViewFeedback,
  };
}

export function useSubmitFeedbackModalVisible() {
  const [feedbackByScreenshot] = useAtom(feedbackByScreenshotAtom);
  return { submitFeedbackModalVisible: feedbackByScreenshot.submitModalShown };
}

export function useSubmitSuccessModalVisible() {
  const [feedbackByScreenshot, setFeedbackByScreenshot] = useAtom(
    feedbackByScreenshotAtom,
  );

  const closeSubmitSuccessModal = useCallback(() => {
    setFeedbackByScreenshot(prev => ({
      ...prev,
      submitSuccessModalShown: false,
    }));
  }, [setFeedbackByScreenshot]);

  return {
    submitSuccessModalVisible: feedbackByScreenshot.submitSuccessModalShown,
    closeSubmitSuccessModal,
  };
}

function useLastScreenshot() {
  const [feedbackByScreenshot, setFeedbackByScreenshot] = useAtom(
    feedbackByScreenshotAtom,
  );

  const setLastScreenshot = useCallback(
    (image: ImageResolvedAssetSource | null) => {
      setFeedbackByScreenshot(prev => ({
        ...prev,
        lastScreenshot: image,
        submitModalShown: !!image,
        feedbackText: '',
      }));
    },
    [setFeedbackByScreenshot],
  );

  const shouldToastFeedbackByScreenshot = useAtomCallback(get => {
    const feedbackByScreenshot = get(feedbackByScreenshotAtom);
    return (
      !feedbackByScreenshot.viewingFeedback &&
      !feedbackByScreenshot.submitModalShown
    );
  });

  return {
    shouldToastFeedbackByScreenshot,
    lastScreenshot: feedbackByScreenshot.lastScreenshot,
    setLastScreenshot,
  };
}
export function useUserDidTakeScreenshot({
  isTop = false,
}: {
  isTop?: boolean;
} = {}) {
  useEffect(() => {
    if (!isTop) return;

    // For Android, check if we should use Android 14+ screen capture detection
    const androidVersion = Platform.Version as number;

    // Listen for screen capture detection events on Android 14+
    const cbs = {
      screenCaptureChangedListener: null as { remove: () => void } | null,
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

    return () => {
      if (androidVersion >= 34) {
        // Android 14+ - stop screen capture detection
        RNScreenshotPrevent.stopScreenCaptureDetection();
      }

      cbs.screenCaptureChangedListener?.remove();
    };
  }, [isTop]);

  const { shouldToastFeedbackByScreenshot, setLastScreenshot } =
    useLastScreenshot();

  useEffect(() => {
    if (!isTop) return;

    const { remove } = RNScreenshotPrevent.onUserDidTakeScreenshot(
      async params => {
        if (!params?.captured) return;

        if (!shouldToastFeedbackByScreenshot()) return;

        const sizes = {
          height: coerceNumber(params?.height, 100),
          width: coerceNumber(params?.width, 100),
        };
        const fullPath = params?.path
          ? AppScreenshotFS.normalizeFilePath(params.path)
          : '';

        let inAppPath: string | null = null;
        if (params?.imageBase64) {
          setLastScreenshot(
            Image.resolveAssetSource({
              // TODO: set contentType by params.type
              uri: AppScreenshotFS.normalizeBase64(
                params.imageBase64,
                params.imageType || 'image/jpeg',
              ),
              height: sizes.height,
              width: sizes.width,
            }),
          );
        } else if (fullPath && (await RNFS.exists(fullPath))) {
          inAppPath = await appScreenshotFS.saveScreenshotFrom(fullPath, {
            imageType: params.imageType,
          });
          if (!inAppPath) return;

          setLastScreenshot(
            Image.resolveAssetSource({
              // TODO: set contentType by params.type
              uri: AppScreenshotFS.normalizeBase64(
                inAppPath,
                params.imageType || 'image/jpeg',
              ),
              height: sizes.height,
              width: sizes.width,
            }),
          );
        }
      },
    );

    return () => {
      remove();
    };
  }, [isTop, shouldToastFeedbackByScreenshot, setLastScreenshot]);
}
export function useFeedbackOnScreenshot() {
  const [submitFeedbackOnScreenshot, setSubmitFeedbackOnScreenshot] = useAtom(
    feedbackByScreenshotAtom,
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

  const showSubmitSuccessModal = useCallback(() => {
    setSubmitFeedbackOnScreenshot(prev => ({
      ...prev,
      submitSuccessModalShown: true,
      submitModalShown: false,
    }));
  }, [setSubmitFeedbackOnScreenshot]);

  return {
    globalModalShown: submitFeedbackOnScreenshot.submitModalShown,
    feedbackText: submitFeedbackOnScreenshot.feedbackText,
    feedbackOverLimit:
      submitFeedbackOnScreenshot.feedbackText.length >
      SCREENSHOT_FEEDBACK_MAX_LENGTH - 1,
    onChangeFeedback,
    showSubmitSuccessModal,
  };
}
export function useSubmitFeedbackOnScreenshot() {
  const [{ lastScreenshot }, setSubmitFeedbackOnScreenshot] = useAtom(
    feedbackByScreenshotAtom,
  );
  const { globalModalShown, feedbackText, showSubmitSuccessModal } =
    useFeedbackOnScreenshot();
  const { onFeedbackSubmitted } = useScreenshotFeedbacks();

  const closeSubmitModal = useCallback(
    ({ clearText = true }: { clearText?: boolean } = {}) => {
      setSubmitFeedbackOnScreenshot(prev => ({
        ...prev,
        submitModalShown: false,
        lastScreenshot: null,
        feedbackText: clearText ? '' : prev.feedbackText,
      }));
    },
    [setSubmitFeedbackOnScreenshot],
  );

  const submitFeedback = useCallback(
    async function () {
      if (!lastScreenshot?.uri) {
        throw new Error('No screenshot available');
      }

      const result = await AppScreenshotFS.uploadFile<{ image_url: string }>(
        lastScreenshot?.uri,
      );

      if (!result?.image_url) return;

      // TODO: report to sentry here, add extra fields here
      const submitResult = await openapi.postUserFeedback({
        title: '',
        image_url_list: [result.image_url],
        content: feedbackText,
      });
      // TODO: report to sentry here, add submitResult.id as extra field here

      closeSubmitModal({ clearText: true });
      if (submitResult.id) {
        showSubmitSuccessModal();
      } else {
        toast.error('Feedback submission failed, please try again later');
      }

      onFeedbackSubmitted(submitResult);
    },
    [
      feedbackText,
      lastScreenshot?.uri,
      closeSubmitModal,
      showSubmitSuccessModal,
      onFeedbackSubmitted,
    ],
  );

  return {
    lastScreenshot,
    globalModalShown,
    feedbackText,

    closeSubmitModal,
    submitFeedback,

    canSubmitFeedback: !!lastScreenshot?.uri,
  };
}
