import { atom, useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';

export const SCREENSHOT_FEEDBACK_MAX_LENGTH = 301;
const submitFeedbackOnScreenshotAtom = atom({
  modalShown: __DEV__,
  feedbackText: '',
});
export function useSubmitFeedbackOnScreenshot() {
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

  const globalModalShown = useMemo(() => {
    return submitFeedbackOnScreenshot.modalShown;
  }, [submitFeedbackOnScreenshot]);

  return {
    globalModalShown,
    feedbackText: submitFeedbackOnScreenshot.feedbackText,
    feedbackOverLimit:
      submitFeedbackOnScreenshot.feedbackText.length >
      SCREENSHOT_FEEDBACK_MAX_LENGTH - 1,
    onChangeFeedback,
  };
}
