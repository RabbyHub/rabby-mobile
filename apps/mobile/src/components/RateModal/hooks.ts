import { useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import { coerceInteger } from '@/utils/number';

function coerceStar(value: number): number {
  return coerceInteger(Math.max(0, Math.min(5, value)));
}

const FEEDBACK_LEN_LIMIT = 300;
const GET_DEFAULT_VALUE = () => ({
  visible: __DEV__ ? true : false, // Default to true in development mode for testing
  userStar: coerceStar(__DEV__ ? 0 : 5),

  userFeedback: '',
});
const rateModalAtom = atom(GET_DEFAULT_VALUE());

export function useRateModal() {
  const [rateModalState, setRateModalState] = useAtom(rateModalAtom);

  const toggleShowRateModal = useCallback(
    (nextValue: boolean = !rateModalState.visible) => {
      setRateModalState(prev => {
        return {
          ...prev,
          visible: nextValue,
        };

        // if (!nextValue) {
        //   // TODO: mark time
        // }
      });
    },
    [setRateModalState, rateModalState.visible],
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

  return {
    shouldShowGuideOnHome: true,

    rateModalShown: rateModalState.visible,

    userStar: rateModalState.userStar,
    toggleShowRateModal,
    selectStar,

    userFeedback: rateModalState.userFeedback,
    onChangeFeedback,
  };
}
