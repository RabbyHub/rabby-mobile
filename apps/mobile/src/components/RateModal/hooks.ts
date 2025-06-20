import { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import * as Sentry from '@sentry/react-native';

import { coerceInteger } from '@/utils/number';
import { atomByMMKV } from '@/core/storage/mmkv';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { APP_URLS, APP_VERSIONS, APPLICATION_ID } from '@/constant';
import { isNonPublicProductionEnv } from '@/constant/env';
import { Platform } from 'react-native';
import { matomoRequestEvent } from '@/utils/analytics';
import { openExternalUrl } from '@/core/utils/linking';

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
    lastExposureTimestamp?.time &&
    lastExposureTimestamp?.time !== RATE_GUIDE_STATE.INIT &&
    lastExposureTimestamp?.time < Date.now()
  );
}
const rateGuideLastExposureAtom = atomByMMKV(
  '@RateGuideLastExposure',
  getDefaultRateGuideLastExposure(),
);

export function useMakeMockDataForRateGuideExposure() {
  const [, setRateGuideLastExposure] = useAtom(rateGuideLastExposureAtom);
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
  }, [setRateGuideLastExposure]);

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
  const [, setRateGuideLastExposure] = useAtom(rateGuideLastExposureAtom);

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
  }, [isTop, setRateGuideLastExposure]);
}

export function useExposureRateGuide() {
  const [, setRateModalState] = useAtom(rateModalAtom);
  const [
    { txCount, [VERSIONED_KEY]: lastExposureTimestamp },
    setRateGuideLastExposure,
  ] = useAtom(rateGuideLastExposureAtom);

  // if (__DEV__) {
  //   console.debug('[useExposureRateGuide] txCount: %s', txCount);
  // }

  const shouldShowRateGuideOnHome = useMemo(() => {
    return txCount >= TX_COUNT_LIMIT && userCouldRated(lastExposureTimestamp);
  }, [txCount, lastExposureTimestamp]);

  const disableExposureRateGuide = useCallback(() => {
    setRateGuideLastExposure(prev => ({
      ...getDefaultRateGuideLastExposure({
        time: prev[VERSIONED_KEY]?.time,
        userViewedRate: true,
      }),
    }));
    setRateModalState(getDefaultValue());
  }, [setRateGuideLastExposure, setRateModalState]);

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
});
const rateModalAtom = atom(getDefaultValue());

export function useRateModal() {
  const [rateModalState, setRateModalState] = useAtom(rateModalAtom);
  const { disableExposureRateGuide } = useExposureRateGuide();

  const toggleShowRateModal = useCallback(
    (
      nextValue: boolean = !rateModalState.visible,
      options?: {
        starCountOnOpen?: number;
        disableExposureOnClose?: boolean;
      },
    ) => {
      const nextState = {
        ...getDefaultValue(),
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
    },
    [setRateModalState, rateModalState.visible, disableExposureRateGuide],
  );

  const selectStar = useCallback(
    (star: number) => {
      setRateModalState(prev => ({
        ...prev,
        userStar: coerceStar(star),
      }));
    },
    [setRateModalState],
  );

  const onChangeFeedback = useCallback(
    (feedback: string) => {
      setRateModalState(prev => ({
        ...prev,
        userFeedback: feedback.slice(0, FEEDBACK_LEN_LIMIT), // Limit feedback to 300 characters
      }));
    },
    [setRateModalState],
  );

  const submitFeedback = useCallback(
    async (params: { totalBalanceText: string }) => {
      if (rateModalState.userStar > 3) return;

      const feedbackText = rateModalState.userFeedback.trim();

      const feedbackContent = [
        `Comment: ${feedbackText}`,
        '  ',
        `Rate: ${makeStarText(rateModalState.userStar, 5)} (${
          rateModalState.userStar
        }) `,
        `Total Balance: ${params.totalBalanceText}`,
        `App Version: ${APP_VERSIONS.forFeedback}`,
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
        await openapi.submitFeedback({
          text: feedbackContent,
          usage: 'rating',
        });
        matomoRequestEvent({
          category: 'Rate Rabby',
          action: 'Rate_SubmitAdvice',
          label: [rateModalState.userStar].join('|'),
        });
      } catch (error) {
        Sentry.captureException(error, {
          extra: {
            rateModalState,
            feedbackContent,
          },
        });
        console.error('Failed to submit feedback:', error);
      }
    },
    [rateModalState],
  );

  const openAppRateUrl = useCallback(() => {
    matomoRequestEvent({
      category: 'Rate Rabby',
      action: 'Rate_JumpAppStore',
      label: [rateModalState.userStar].join('|'),
    });
    openExternalUrl(APP_URLS.RATE_URL);
  }, [rateModalState.userStar]);

  return {
    rateModalShown: rateModalState.visible,

    userStar: rateModalState.userStar,
    toggleShowRateModal,
    selectStar,

    userFeedback: rateModalState.userFeedback,
    feedbackOverLimit:
      rateModalState.userFeedback.length > FEEDBACK_LEN_LIMIT - 1,
    onChangeFeedback,
    submitFeedback,

    openAppRateUrl,
  };
}
