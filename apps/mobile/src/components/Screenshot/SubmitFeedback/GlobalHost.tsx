import React from 'react';

import { registerAppScreen } from '@/perfs/apis';

import { useSubmitFeedbackModalVisible } from '../hooks';

const LazyScreenshotFeedbackSubmitModal = registerAppScreen<
  typeof import('./SubmitModal').ScreenshotFeedbackSubmitModal
>({
  loader: () =>
    import('./SubmitModal').then(m => ({
      default: m.ScreenshotFeedbackSubmitModal,
    })),
});

export function ScreenshotFeedbackHost() {
  const { submitFeedbackModalVisible } = useSubmitFeedbackModalVisible();

  if (!submitFeedbackModalVisible) {
    return null;
  }

  return <LazyScreenshotFeedbackSubmitModal />;
}
