import React from 'react';

import { registerAppScreen } from '@/perfs/apis';

import { useSubmitFeedbackModalVisible } from './hooks';

const LazyModalsSubmitFeedbackByScreenshotStub = registerAppScreen<
  typeof import('./ScreenshotModal').ModalsSubmitFeedbackByScreenshotStub
>({
  loader: () =>
    import('./ScreenshotModal').then(m => ({
      default: m.ModalsSubmitFeedbackByScreenshotStub,
    })),
});

export function ScreenshotFeedbackGlobalHost() {
  const { submitFeedbackModalVisible } = useSubmitFeedbackModalVisible();

  if (!submitFeedbackModalVisible) {
    return null;
  }

  return <LazyModalsSubmitFeedbackByScreenshotStub />;
}
