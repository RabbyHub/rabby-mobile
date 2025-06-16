import { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import * as Sentry from '@sentry/react-native';

import { coerceInteger } from '@/utils/number';
import { atomByMMKV } from '@/core/storage/mmkv';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { APP_VERSIONS, APPLICATION_ID } from '@/constant';
import { isNonPublicProductionEnv } from '@/constant/env';
import { Platform } from 'react-native';

const TX_COUNT_LIMIT = __DEV__ ? 3 : 5; // Minimum number of transactions before showing the rate guide
const STAR_COUNT = 5;

/**
 * @description if you want reactivate the rate guide, you can set this to a timestamp to the new exposure time.
 */
const VERSIONED_KEY = 'lastExposure_20250616_1' as const;
const rateGuideLastExposureAtom = atomByMMKV('@RateGuideLastExposure', {
  txCount: 0,
  [VERSIONED_KEY]: -1 as number,
});

export function useMakeMockDataForRateGuideExposure() {
  const [, setRateGuideLastExposure] = useAtom(rateGuideLastExposureAtom);
  const mockExposureRateGuide = useCallback(() => {
    setRateGuideLastExposure({
      txCount: TX_COUNT_LIMIT,
      [VERSIONED_KEY]: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
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
          const nextCount = prev.txCount + 1;
          return {
            ...prev,
            txCount: nextCount,
            ...(nextCount >= TX_COUNT_LIMIT && { [VERSIONED_KEY]: Date.now() }),
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
  const [
    { txCount, [VERSIONED_KEY]: lastExposureTimestamp },
    setRateGuideLastExposure,
  ] = useAtom(rateGuideLastExposureAtom);

  if (__DEV__) {
    console.debug('[useExposureRateGuide] txCount: %s', txCount);
  }

  const shouldShowRateGuideOnHome = useMemo(() => {
    return txCount >= TX_COUNT_LIMIT && Date.now() > lastExposureTimestamp;
  }, [txCount, lastExposureTimestamp]);

  const disableExposure = useCallback(() => {
    setRateGuideLastExposure(prev => ({
      ...prev,
      txCount: 0,
      lastExposureTimestamp: Infinity,
    }));
  }, [setRateGuideLastExposure]);

  return {
    shouldShowRateGuideOnHome,

    disableExposure,
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

const FEEDBACK_LEN_LIMIT = 300;
const getDefaultValue = () => ({
  visible: false,
  userStar: STAR_COUNT,

  userFeedback: '',
});
const rateModalAtom = atom(getDefaultValue());

export function useRateModal() {
  const [rateModalState, setRateModalState] = useAtom(rateModalAtom);
  const { disableExposure } = useExposureRateGuide();

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
        disableExposure();
      } else if (
        nextValue &&
        options?.starCountOnOpen &&
        coerceStar(options?.starCountOnOpen)
      ) {
        nextState.userStar = coerceStar(options?.starCountOnOpen);
      }
      setRateModalState(nextState);
    },
    [setRateModalState, rateModalState.visible, disableExposure],
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
        await openapi.uninstalledFeedback({ text: feedbackContent });
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

  return {
    rateModalShown: rateModalState.visible,

    userStar: rateModalState.userStar,
    toggleShowRateModal,
    selectStar,

    userFeedback: rateModalState.userFeedback,
    onChangeFeedback,
    submitFeedback,
  };
}
