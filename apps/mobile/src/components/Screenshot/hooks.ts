import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Image, ImageResolvedAssetSource } from 'react-native';
import RNFS from 'react-native-fs';
import { atom, useAtom } from 'jotai';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { openapi } from '@/core/request';
import { AppScreenshotFS, appScreenshotFS } from '@/core/storage/fs';
import { coerceNumber } from '@/utils/coerce';
import { appJsonStore, zustandByMMKV } from '@/core/storage/mmkv';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
import { useAtomCallback } from 'jotai/utils';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { useRefState } from '@/hooks/common/useRefState';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { isNonPublicProductionEnv } from '@/constant';
import { getScreenshotFeedbackExtra } from './utils';
import { getGlobalScreenCapturable } from '@/hooks/native/security';
import { pick } from 'lodash';
import {
  resolveValFromUpdater,
  runDevIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

export const FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT = IS_ANDROID && !__DEV__;
type LocalUserFeedbackItem = Pick<UserFeedbackItem, 'id' | 'create_at'>;
type ScreenshotFeedbackStore = {
  viewedHomeTip: boolean;
  feedbacks: LocalUserFeedbackItem[];
  showFeedbackOnScreenshot_20250923: boolean | null;
  disableScreenshotToReportUntil: number; // timestamp
};
const getDefaultValueFeedback = (): ScreenshotFeedbackStore => ({
  viewedHomeTip: FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT,
  feedbacks: [] as LocalUserFeedbackItem[],
  showFeedbackOnScreenshot_20250923: true,
  disableScreenshotToReportUntil: -1,
});
const Keys = Object.keys(
  getDefaultValueFeedback(),
) as (keyof ScreenshotFeedbackStore)[];
function trimScreenshotFeedbackStore<T extends ScreenshotFeedbackStore>(
  input: T,
): ScreenshotFeedbackStore {
  return pick(input, Keys);
}

// runDevIIFEFunc(() => {
//   appJsonStore.setItem('@screenshotFeedback', {
//     viewedHomeTip: false,
//     feedbacks: [],
//     showFeedbackOnScreenshot_20250923: true,
//     disableScreenshotToReportUntil: -1,
//   });
// });
const screenshotFeedbackStore = zustandByMMKV(
  '@screenshotFeedback',
  getDefaultValueFeedback(),
);

function setScreenshotFeedback(
  valOrFunc: UpdaterOrPartials<ScreenshotFeedbackStore>,
) {
  screenshotFeedbackStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return trimScreenshotFeedbackStore(newVal);
  });
}

const toggleScreenshotToReport = (nextVal?: boolean) => {
  setScreenshotFeedback(prev => {
    if (nextVal === undefined) {
      const prevEnabled = !!prev.showFeedbackOnScreenshot_20250923;
      nextVal = !prevEnabled;
    }

    return {
      ...prev,
      showFeedbackOnScreenshot_20250923: nextVal,
    };
  });
};

const toggleSkipReportIn24Hours = (nextVal: boolean = true) => {
  setScreenshotFeedback(prev => {
    if (nextVal) {
      return {
        ...prev,
        disableScreenshotToReportUntil: Date.now() + 24 * 60 * 60 * 1000,
      };
    } else {
      return {
        ...prev,
        disableScreenshotToReportUntil: -1,
      };
    }
  });
};

function isEnabledScreenshotToReport({
  showFeedbackOnScreenshot,
  disableScreenshotToReportUntil,
}: {
  showFeedbackOnScreenshot: boolean | null;
  disableScreenshotToReportUntil: number | null;
}) {
  if (showFeedbackOnScreenshot === false) return false;

  disableScreenshotToReportUntil = disableScreenshotToReportUntil || 0;

  return disableScreenshotToReportUntil < Date.now();
}

export function useScreenshotToReportEnabled() {
  const { disableScreenshotToReportUntil, showFeedbackOnScreenshot_20250923 } =
    screenshotFeedbackStore(
      useShallow(s => ({
        disableScreenshotToReportUntil: s.disableScreenshotToReportUntil,
        showFeedbackOnScreenshot_20250923: s.showFeedbackOnScreenshot_20250923,
      })),
    );

  const isShowFeedbackOnScreenshot = useMemo(() => {
    return showFeedbackOnScreenshot_20250923 != false;
  }, [showFeedbackOnScreenshot_20250923]);

  return {
    disableScreenshotToReportUntil: disableScreenshotToReportUntil,
    isShowFeedbackOnScreenshot,
    toggleScreenshotToReport,
    toggleSkipReportIn24Hours,
  };
}

export function useGetShowFeedbackOnScreenshotCapture() {
  const getShowFeedbackOnScreenshotCapture = useAtomCallback(get => {
    const values = screenshotFeedbackStore.getState();
    return isEnabledScreenshotToReport({
      showFeedbackOnScreenshot: values.showFeedbackOnScreenshot_20250923,
      disableScreenshotToReportUntil: values.disableScreenshotToReportUntil,
    });
  });

  return { getShowFeedbackOnScreenshotCapture };
}

const markViewedHomeTip = () => {
  if (screenshotFeedbackStore.getState().viewedHomeTip) return;
  setScreenshotFeedback(prev => ({
    ...prev,
    viewedHomeTip: true,
  }));
};

const mockResetViewedHomeTip = () => {
  if (!isNonPublicProductionEnv) return;
  setScreenshotFeedback(prev => ({
    ...prev,
    viewedHomeTip: false,
  }));
};

export function useViewedHomeTip() {
  const { viewedHomeTip } = screenshotFeedbackStore(
    useShallow(s => ({
      viewedHomeTip: s.viewedHomeTip,
    })),
  );

  return {
    viewedHomeTip: FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT ? true : viewedHomeTip,
    markViewedHomeTip,
    mockResetViewedHomeTip,
  };
}

export function sortFeedbackItemByCreateAtDesc(
  a: LocalUserFeedbackItem,
  b: LocalUserFeedbackItem,
) {
  return b.create_at - a.create_at;
}

export const LATEST_LOCAL_FEEDBACK_LIMIT = 10;

const onFeedbackSubmitted = (idOrItem: LocalUserFeedbackItem) => {
  setScreenshotFeedback(prev => {
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
};

const clearFeedbacks = () => {
  setScreenshotFeedback(prev => ({ ...prev, feedbacks: [] }));
};

const removeLocalFeedback = (id: string) => {
  setScreenshotFeedback(prev => {
    const list = prev.feedbacks.filter(item => item.id !== id);
    return {
      ...prev,
      feedbacks: Array.from(list).slice(0, LATEST_LOCAL_FEEDBACK_LIMIT),
    };
  });
};

function useScreenshotFeedbacks() {
  return {
    onFeedbackSubmitted,
    clearFeedbacks,
    removeLocalFeedback,
  };
}

export function useLatestRepliedFeedbacks() {
  const { feedbacks } = screenshotFeedbackStore(
    useShallow(s => ({
      feedbacks: s.feedbacks,
    })),
  );

  const { localFeedbacks } = useMemo(() => {
    return {
      localFeedbacks: feedbacks
        .sort(sortFeedbackItemByCreateAtDesc)
        .slice(0, LATEST_LOCAL_FEEDBACK_LIMIT),
    };
  }, [feedbacks]);

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

function getDefaultValue(): {
  lastScreenshot: ImageResolvedAssetSource | null;
  submitModalShown: boolean;
  feedbackText: string;
  uploadedImageUrl: string;

  totalBalanceText: string;

  viewingFeedback: UserFeedbackItem | null;
} {
  return {
    lastScreenshot: null,
    submitModalShown: false,
    feedbackText: '',
    uploadedImageUrl: '',

    totalBalanceText: '',

    viewingFeedback: null,
  };
}
export const SCREENSHOT_FEEDBACK_MAX_LENGTH = 301;
const feedbackByScreenshotAtom = atom(getDefaultValue());

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

export function useSetTotalBalanceText(totalBalanceText: string) {
  const [, setFeedbackByScreenshot] = useAtom(feedbackByScreenshotAtom);

  useEffect(() => {
    setFeedbackByScreenshot(prev => ({
      ...prev,
      totalBalanceText,
    }));
  }, [totalBalanceText, setFeedbackByScreenshot]);
}

export function useSubmitFeedbackModalVisible() {
  const [feedbackByScreenshot] = useAtom(feedbackByScreenshotAtom);
  return {
    submitFeedbackModalVisible: feedbackByScreenshot.submitModalShown,
  };
}

function useLastScreenshot() {
  const [feedbackByScreenshot, setFeedbackByScreenshot] = useAtom(
    feedbackByScreenshotAtom,
  );

  const setLastScreenshot = useCallback(
    (image: ImageResolvedAssetSource | null, uploadNow = false) => {
      setFeedbackByScreenshot(prev => ({
        ...prev,
        lastScreenshot: image,
        submitModalShown: !!image,
        feedbackText: '',
      }));

      if (image?.uri && uploadNow) {
        AppScreenshotFS.uploadFile<{ image_url: string }>(image?.uri).then(
          result => {
            if (result?.image_url) {
              setFeedbackByScreenshot(prev => ({
                ...prev,
                uploadedImageUrl: result.image_url,
              }));
            }
          },
        );
      }
    },
    [setFeedbackByScreenshot],
  );

  const shouldToastFeedbackByScreenshot = useAtomCallback(get => {
    if (FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT) return false;
    if (!getGlobalScreenCapturable()) return false;

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
  const { shouldToastFeedbackByScreenshot, setLastScreenshot } =
    useLastScreenshot();

  const { getShowFeedbackOnScreenshotCapture } =
    useGetShowFeedbackOnScreenshotCapture();

  useEffect(() => {
    if (!isTop) return;

    const { remove } = RNScreenshotPrevent.iosOnUserDidTakeScreenshot(
      async params => {
        if (!getShowFeedbackOnScreenshotCapture()) return;
        if (!params?.captured) {
          if (IS_ANDROID && params && !params?.androidHasPermission) return;
        }

        if (!shouldToastFeedbackByScreenshot()) return;

        const sizes = {
          height: coerceNumber(params?.height, 100),
          width: coerceNumber(params?.width, 100),
        };
        const fullPath = params?.path
          ? AppScreenshotFS.normalizeFilePath(params.path)
          : '';

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
          const inAppPath = await appScreenshotFS.saveScreenshotFrom(fullPath, {
            imageType: params?.imageType,
          });
          if (!inAppPath) return;

          setLastScreenshot(
            Image.resolveAssetSource({
              // TODO: set contentType by params.type
              uri: AppScreenshotFS.normalizeBase64(
                inAppPath,
                params?.imageType || 'image/jpeg',
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
  }, [
    isTop,
    shouldToastFeedbackByScreenshot,
    setLastScreenshot,
    getShowFeedbackOnScreenshotCapture,
  ]);
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

  return {
    globalModalShown: submitFeedbackOnScreenshot.submitModalShown,
    feedbackText: submitFeedbackOnScreenshot.feedbackText,
    feedbackOverLimit:
      submitFeedbackOnScreenshot.feedbackText.length >
      SCREENSHOT_FEEDBACK_MAX_LENGTH - 1,
    uploadedImageUrl: submitFeedbackOnScreenshot.uploadedImageUrl,
    onChangeFeedback,
  };
}
export function useSubmitFeedbackOnScreenshot() {
  const [{ lastScreenshot, totalBalanceText }, setSubmitFeedbackOnScreenshot] =
    useAtom(feedbackByScreenshotAtom);
  const { globalModalShown, feedbackText, uploadedImageUrl } =
    useFeedbackOnScreenshot();
  const { onFeedbackSubmitted } = useScreenshotFeedbacks();

  const { toggleSkipReportIn24Hours } = useScreenshotToReportEnabled();

  const closeSubmitModal = useCallback(
    ({
      skipInNext1Day = false,
      clearText = true,
    }: { skipInNext1Day?: boolean; clearText?: boolean } = {}) => {
      if (skipInNext1Day) {
        toggleSkipReportIn24Hours(true);
      }
      setSubmitFeedbackOnScreenshot(prev => ({
        ...prev,
        submitModalShown: false,
        lastScreenshot: null,
        feedbackText: clearText ? '' : prev.feedbackText,
        uploadedImageUrl: '',
      }));
    },
    [toggleSkipReportIn24Hours, setSubmitFeedbackOnScreenshot],
  );

  const { stateRef: isSubmittingRef, setRefState: setSubmitting } =
    useRefState(false);
  const submitFeedbackByScreenshot = useCallback(
    async function () {
      const extraInfo = await getScreenshotFeedbackExtra({ totalBalanceText });
      // console.debug('[debug] extraInfo', extraInfo);

      if (isSubmittingRef.current) return;
      setSubmitting(true, true);

      let submitResult: UserFeedbackItem | null = null;
      try {
        let imageUrl = uploadedImageUrl;
        if (!imageUrl && lastScreenshot?.uri) {
          const result = await AppScreenshotFS.uploadFile<{
            image_url: string;
          }>(lastScreenshot?.uri);
          if (!result?.image_url) return;
          imageUrl = result.image_url;
        }

        if (!imageUrl) {
          throw new Error('No screenshot available');
        }

        // TODO: report to sentry here, add extra fields here
        submitResult = await openapi.postUserFeedback({
          title: '',
          image_url_list: [imageUrl],
          content: feedbackText,
          extra: extraInfo,
        });
        // TODO: report to sentry here, add submitResult.id as extra field here
      } catch (error) {
        console.error('feedback submission error', error);
      } finally {
        setSubmitting(false, true);
      }

      if (submitResult?.id) {
        onFeedbackSubmitted(submitResult);
      } else {
        console.error('Feedback submission failed, please try again later');
      }
    },
    [
      feedbackText,
      totalBalanceText,
      uploadedImageUrl,
      lastScreenshot?.uri,
      isSubmittingRef,
      setSubmitting,
      onFeedbackSubmitted,
    ],
  );

  return {
    lastScreenshot,
    globalModalShown,
    feedbackText,

    closeSubmitModal,
    isSubmitting: isSubmittingRef.current,
    submitFeedbackByScreenshot,

    canSubmitFeedback: !!lastScreenshot?.uri && !!feedbackText.trim(),
  };
}
