import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Image, ImageResolvedAssetSource } from 'react-native';
import RNFS from 'react-native-fs';

import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { openapi } from '@/core/request';
import { AppScreenshotFS, appScreenshotFS } from '@/core/storage/fs';
import { coerceNumber } from '@/utils/coerce';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
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
import { zCreate } from '@/core/utils/reexports';
import DeviceUtils from '@/core/utils/device';
import { perfEvents } from '@/core/utils/perf';

export const FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT =
  IS_ANDROID && !DeviceUtils.isGteAndroid(14);
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

type ScreenshotState = {
  isScreenshotReportFree: boolean;
};
const screenshotState = zCreate<ScreenshotState>(() => ({
  isScreenshotReportFree: false,
}));

function markIsScreenshotReportFree(isFree: boolean) {
  screenshotState.setState(prev => ({
    ...prev,
    isScreenshotReportFree: isFree,
  }));
}

export const storeApiScreenshotReport = {
  markIsScreenshotReportFree,
  isScreenshotReportFree: () => {
    return screenshotState.getState().isScreenshotReportFree;
  },
};

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

export const getShowFeedbackOnScreenshotCapture = () => {
  const values = screenshotFeedbackStore.getState();
  return isEnabledScreenshotToReport({
    showFeedbackOnScreenshot: values.showFeedbackOnScreenshot_20250923,
    disableScreenshotToReportUntil: values.disableScreenshotToReportUntil,
  });
};

export function useIsShowFeedbackOnScreenshot() {
  const { disableScreenshotToReportUntil, showFeedbackOnScreenshot_20250923 } =
    screenshotFeedbackStore(
      useShallow(s => ({
        disableScreenshotToReportUntil: s.disableScreenshotToReportUntil,
        showFeedbackOnScreenshot_20250923: s.showFeedbackOnScreenshot_20250923,
      })),
    );

  const isScreenshotReportEnabled = isEnabledScreenshotToReport({
    showFeedbackOnScreenshot: showFeedbackOnScreenshot_20250923,
    disableScreenshotToReportUntil: disableScreenshotToReportUntil,
  });

  return { isScreenshotReportEnabled };
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

type FeedbackByScreenshotState = {
  lastScreenshot: ImageResolvedAssetSource | null;
  submitModalShown: boolean;
  feedbackText: string;
  uploadedImageUrl: string;

  totalBalanceText: string;

  viewingFeedback: UserFeedbackItem | null;
};
function getDefaultValue(): FeedbackByScreenshotState {
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
const feedbackByScreenshotStore = zCreate<FeedbackByScreenshotState>(() => ({
  ...getDefaultValue(),
}));

function setFeedbackByScreenshot(
  valOrFunc: UpdaterOrPartials<FeedbackByScreenshotState>,
) {
  feedbackByScreenshotStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

const startViewingFeedback = (feedback: UserFeedbackItem) => {
  setFeedbackByScreenshot(prev => ({
    ...prev,
    viewingFeedback: feedback,
  }));
};

const finishViewFeedback = () => {
  const viewingFeedback = feedbackByScreenshotStore.getState().viewingFeedback;
  if (viewingFeedback) {
    removeLocalFeedback(viewingFeedback?.id);
  }
  setFeedbackByScreenshot(prev => ({
    ...prev,
    viewingFeedback: null,
  }));
};

export function useViewingFeedback() {
  const viewingFeedback = feedbackByScreenshotStore(s => s.viewingFeedback);

  return {
    viewingFeedback,
    startViewingFeedback,
    finishViewFeedback,
  };
}

export function screenshotModalStartSyncNetworth() {
  perfEvents.subscribe('SCENE_24H_BALANCE_UPDATED', ({ combinedData }) => {
    const netWorth = combinedData.netWorth;
    setFeedbackByScreenshot(prev => ({
      ...prev,
      totalBalanceText: netWorth,
    }));
  });
}

export function useSubmitFeedbackModalVisible() {
  const submitModalShown = feedbackByScreenshotStore(s => s.submitModalShown);

  return {
    submitFeedbackModalVisible: submitModalShown,
  };
}

const shouldToastFeedbackByScreenshot = () => {
  if (FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT) return false;
  if (!getGlobalScreenCapturable()) return false;

  if (storeApiScreenshotReport.isScreenshotReportFree()) return false;

  const feedbackByScreenshot = feedbackByScreenshotStore.getState();
  return (
    !feedbackByScreenshot.viewingFeedback &&
    !feedbackByScreenshot.submitModalShown
  );
};

const setLastScreenshot = (
  image: ImageResolvedAssetSource | null,
  uploadNow = false,
) => {
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
};

if (IS_ANDROID && !FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT) {
  RNScreenshotPrevent.startScreenCaptureDetection().then(() => {
    console.debug(
      '[info] RNScreenshotPrevent started screen capture detection on Android',
    );
  });
}

export function startSubscribeUserDidTakeScreenshot() {
  const subscription = RNScreenshotPrevent.onUserDidTakeScreenshot(
    async params => {
      if (!getShowFeedbackOnScreenshotCapture()) return;
      if (!params?.captured) return;

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

  return subscription;
}

const onChangeFeedback = (feedback: string) => {
  setFeedbackByScreenshot(prev => ({
    ...prev,
    feedbackText: feedback.slice(0, SCREENSHOT_FEEDBACK_MAX_LENGTH), // Limit feedback to 1000 characters
  }));
};

export function useFeedbackOnScreenshot() {
  const submitFeedbackOnScreenshot = feedbackByScreenshotStore(s => s);

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

const closeSubmitModal = ({
  skipInNext1Day = false,
  clearText = true,
}: { skipInNext1Day?: boolean; clearText?: boolean } = {}) => {
  if (skipInNext1Day) {
    toggleSkipReportIn24Hours(true);
  }
  setFeedbackByScreenshot(prev => ({
    ...prev,
    submitModalShown: false,
    lastScreenshot: null,
    feedbackText: clearText ? '' : prev.feedbackText,
    uploadedImageUrl: '',
  }));
};

export function useSubmitFeedbackOnScreenshot() {
  const { lastScreenshot, totalBalanceText } = feedbackByScreenshotStore(
    useShallow(s => ({
      lastScreenshot: s.lastScreenshot,
      totalBalanceText: s.totalBalanceText,
    })),
  );

  const { globalModalShown, feedbackText, uploadedImageUrl } =
    useFeedbackOnScreenshot();
  const { onFeedbackSubmitted } = useScreenshotFeedbacks();

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
