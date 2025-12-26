import { useCallback, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react-native';

import { coerceInteger } from '@/utils/number';
import {
  appJsonStore,
  MMKVStorageStrategy,
  zustandByMMKV,
} from '@/core/storage/mmkv';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { APP_URLS, APP_VERSIONS, APPLICATION_ID } from '@/constant';
import { isNonPublicProductionEnv } from '@/constant';
import { Platform } from 'react-native';
import { matomoRequestEvent } from '@/utils/analytics';
import { openExternalUrl } from '@/core/utils/linking';
import {
  resolveValFromUpdater,
  runDevIIFEFunc,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { zCreate } from '@/core/utils/reexports';
import { perfEvents } from '@/core/utils/perf';

const TX_COUNT_LIMIT = isNonPublicProductionEnv ? 1 : 3; // Minimum number of transactions before showing the rate guide
const STAR_COUNT = 5;

const VERSIONED_KEY = 'lastExposure_20250618_1' as const;
const enum RATE_GUIDE_STATE {
  INIT = -1,
}
/**
 * @description if you want re-activate the rate guide, you can set this to a timestamp to the new exposure time.
 */
type RateGuideLastExposure = {
  txCount: number;
  latestTxHashes?: string[]; // Array of latest transaction hashes
  [VERSIONED_KEY]?:
    | {
        time: number; // Timestamp of the last exposure
        userViewedRate?: boolean; // Whether the user has rated the guide
      }
    | undefined;
};
const getDefaultRateGuideLastExposure = (
  lastExposureTimestamp: Partial<
    RateGuideLastExposure[typeof VERSIONED_KEY]
  > = {
    time: RATE_GUIDE_STATE.INIT,
    userViewedRate: false,
  },
): RateGuideLastExposure => ({
  txCount: 0,
  latestTxHashes: [],
  [VERSIONED_KEY]: {
    time: RATE_GUIDE_STATE.INIT,
    userViewedRate: false,
    ...lastExposureTimestamp,
  },
});
function userCouldRated(
  lastExposureTimestamp: ReturnType<
    typeof getDefaultRateGuideLastExposure
  >[typeof VERSIONED_KEY],
) {
  return (
    !lastExposureTimestamp?.userViewedRate &&
    !!lastExposureTimestamp?.time &&
    lastExposureTimestamp?.time !== RATE_GUIDE_STATE.INIT &&
    lastExposureTimestamp?.time < Date.now()
  );
}

// runDevIIFEFunc(() => {
//   appJsonStore.setItem('@RateGuideLastExposure', {
//     "txCount": 5,
//     "latestTxHashes": [
//       "0x3f7a954c46788987a9b76c2c53bb5bdd5a29d03bc13ff8accab9e08ea5423bb1",
//       "0x1f110d36a222e2f681fdf072283cdda811ce53a72fa1c71f31f36b3cc834c568",
//       "0x0161475a1a9c0769e366eeb0cad7345b8d16112343f1613c1a253826b1642fa6",
//       "0x6bc4b5b4478d18ca3a54d3f99fdf47530caa3a698480101461f9be216bd96c73",
//       "0x2f550e9623483534bc3aceb43f35724c904f5915e1764c77125e439bf0bb0dbe"
//     ],
//     "lastExposure_20250618_1": {
//       "time": 1764939006316,
//       "userViewedRate": true
//     }
//   })
// })

const rateGuideLastExposureState = zustandByMMKV(
  '@RateGuideLastExposure',
  getDefaultRateGuideLastExposure(),
  { storage: MMKVStorageStrategy.compatJson },
);

function setRateGuideLastExposure(
  valOrFunc: UpdaterOrPartials<RateGuideLastExposure>,
) {
  rateGuideLastExposureState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);

    return newVal;
  });
}

export function useMakeMockDataForRateGuideExposure() {
  const mockExposureRateGuide = useCallback(() => {
    setRateGuideLastExposure({
      ...getDefaultRateGuideLastExposure({
        time: Date.now() - 1000 * 60 * 60 * 24,
        userViewedRate: false,
      }),
      txCount: TX_COUNT_LIMIT,
      latestTxHashes: Array.from({ length: TX_COUNT_LIMIT }).map(
        (_, index) => `0x${index + 1}`,
      ),
    });
  }, []);

  return {
    mockExposureRateGuide,
  };
}

/** @description only call this hook on top of App */
export function useIncreaseTxCountOnAppTop({
  isTop = false,
}: {
  isTop?: boolean;
}) {
  useEffect(() => {
    if (!isTop) return;

    const onTxCompleted: EventBusListeners[typeof EVENTS.TX_COMPLETED] =
      txDetail => {
        console.debug('[useIncreaseTxCountOnAppTop] onTxCompleted', txDetail);
        setRateGuideLastExposure(prev => {
          let latestTxHashes = prev.latestTxHashes || [];
          console.debug('[useIncreaseTxCountOnAppTop] prev', prev);

          if (txDetail?.hash && !latestTxHashes.includes(txDetail?.hash)) {
            latestTxHashes.push(txDetail?.hash);
          }
          latestTxHashes = latestTxHashes.slice(
            0,
            Math.max(10, TX_COUNT_LIMIT),
          );

          const nextCount = latestTxHashes.length;

          return {
            ...prev,
            txCount: nextCount,
            latestTxHashes,
            ...(nextCount >= TX_COUNT_LIMIT && {
              [VERSIONED_KEY]: { ...prev[VERSIONED_KEY], time: Date.now() },
            }),
          };
        });
      };
    eventBus.addListener(EVENTS.TX_COMPLETED, onTxCompleted);

    return () => {
      eventBus.removeListener(EVENTS.TX_COMPLETED, onTxCompleted);
    };
  }, [isTop]);
}

const disableExposureRateGuide = () => {
  setRateGuideLastExposure(prev => ({
    ...getDefaultRateGuideLastExposure({
      time: prev[VERSIONED_KEY]?.time,
      userViewedRate: true,
    }),
  }));
  setRateModalState(getDefaultValue());
};

export function useExposureRateGuide() {
  const { txCount, [VERSIONED_KEY]: lastExposureTimestamp } =
    rateGuideLastExposureState(
      useShallow(s => ({
        txCount: s.txCount,
        [VERSIONED_KEY]: s[VERSIONED_KEY],
      })),
    );

  // if (__DEV__) {
  //   console.debug('[useExposureRateGuide] txCount: %s', txCount);
  // }

  const shouldShowRateGuideOnHome = useMemo(() => {
    return txCount >= TX_COUNT_LIMIT && userCouldRated(lastExposureTimestamp);
  }, [txCount, lastExposureTimestamp]);

  return {
    shouldShowRateGuideOnHome,
    // shouldShowRateGuideOnHome: __DEV__ ? true : shouldShowRateGuideOnHome,

    disableExposureRateGuide,
  };
}

function coerceStar(value: number): number {
  return coerceInteger(Math.max(0, Math.min(STAR_COUNT, value)));
}

function makeStarText(count: number, total = 5) {
  return Array.from({ length: total })
    .map((_, index) => (index < count ? '★' : '☆'))
    .join('');
}

export const FEEDBACK_LEN_LIMIT = 301;
const getDefaultValue = () => ({
  visible: false,
  userStar: STAR_COUNT,

  userFeedback: '',
  isSubmitting: false,

  totalBalanceText: '',
});
const rateModalStore = zCreate(() => getDefaultValue());
function setRateModalState(
  valOrFunc: UpdaterOrPartials<ReturnType<typeof getDefaultValue>>,
) {
  rateModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);

    return { ...prev, ...newVal };
  });
}

export function rateModalStartSyncNetworth() {
  perfEvents.subscribe('SCENE_24H_BALANCE_UPDATED', ({ combinedData }) => {
    const netWorth = combinedData.netWorth;
    setRateModalState(prev => ({
      ...prev,
      totalBalanceText: netWorth,
    }));
  });
}

const toggleShowRateModal = (
  nextValue: boolean = !rateModalStore.getState().visible,
  options?: {
    starCountOnOpen?: number;
    disableExposureOnClose?: boolean;
  },
) => {
  const nextState = {
    ...rateModalStore.getState(),
    visible: nextValue,
  };

  if (!nextValue && options?.disableExposureOnClose) {
    disableExposureRateGuide();
  } else if (
    nextValue &&
    options?.starCountOnOpen &&
    coerceStar(options?.starCountOnOpen)
  ) {
    nextState.userStar = coerceStar(options?.starCountOnOpen);
  }
  setRateModalState(nextState);
};

const selectStar = (star: number) => {
  setRateModalState(prev => ({
    ...prev,
    userStar: coerceStar(star),
  }));
};

const onChangeFeedback = (feedback: string) => {
  setRateModalState(prev => ({
    ...prev,
    userFeedback: feedback.slice(0, FEEDBACK_LEN_LIMIT), // Limit feedback to 300 characters
  }));
};

const pushRateDetails = async (params?: { userStar?: number }) => {
  const rmState = rateModalStore.getState();
  const userStar = params?.userStar ?? rmState.userStar;
  const needFeedbackText = userStar <= 3;

  const feedbackText = rmState.userFeedback.trim();

  const starText = `${makeStarText(userStar, 5)} (${userStar})`;
  const balanceText = rmState.totalBalanceText;
  const versionText = APP_VERSIONS.forFeedback;

  const feedbackContent = [
    ...(!needFeedbackText
      ? [`${starText} (${balanceText}; ${versionText}) `]
      : [
          `Comment: ${feedbackText}`,
          `Rate: ${starText}`,
          `Total Balance: ${balanceText}`,
          `App Version: ${versionText}`,
          '  ',
        ]),
  ]
    .concat(
      isNonPublicProductionEnv
        ? [
            '  ',
            '(Test Only Below) -----------------------',
            `Platform: ${Platform.OS}`,
            `App ID: ${APPLICATION_ID}`,
          ]
        : [],
    )
    .filter(Boolean)
    .join('\n');
  /**
   * @notice In fact, it's not a real uninstall feedback, but a feedback for rate guide,
   * related request url is /v1/feedback. Just use it to submit the feedback.
   *
   **/

  try {
    setRateModalState(prev => ({ ...prev, isSubmitting: true }));
    if (needFeedbackText) {
      await openapi.submitFeedback({
        text: feedbackContent,
        usage: 'rating',
      });
      matomoRequestEvent({
        category: 'Rate Rabby',
        action: 'Rate_SubmitAdvice',
        label: [userStar].join('|'),
      });
    }
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        rateModalState: rateModalStore.getState(),
        feedbackContent,
      },
    });
    console.error('Failed to submit feedback:', error);
  } finally {
    setRateModalState(prev => ({ ...prev, isSubmitting: false }));
  }
};

const openAppRateUrl = () => {
  matomoRequestEvent({
    category: 'Rate Rabby',
    action: 'Rate_JumpAppStore',
    label: [rateModalStore.getState().userStar].join('|'),
  });
  openExternalUrl(APP_URLS.RATE_URL);
};

export function useRateModal() {
  const visible = rateModalStore(s => s.visible);
  const userStar = rateModalStore(s => s.userStar);
  const userFeedback = rateModalStore(s => s.userFeedback);
  const isSubmitting = rateModalStore(s => s.isSubmitting);

  return {
    rateModalShown: visible,

    userStar: userStar,
    toggleShowRateModal,
    selectStar,

    userFeedback: userFeedback,
    feedbackOverLimit: userFeedback.length > FEEDBACK_LEN_LIMIT - 1,
    onChangeFeedback,
    isSubmitting: isSubmitting,
    pushRateDetails,

    openAppRateUrl,
  };
}
