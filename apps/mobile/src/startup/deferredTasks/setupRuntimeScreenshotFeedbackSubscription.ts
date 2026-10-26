import { startSubscribeUserDidTakeScreenshot } from '@/components/Screenshot/hooks';

let runtimeScreenshotFeedbackSubscriptionPromise: Promise<void> | undefined;

export function startSetupRuntimeScreenshotFeedbackSubscription() {
  if (!runtimeScreenshotFeedbackSubscriptionPromise) {
    runtimeScreenshotFeedbackSubscriptionPromise =
      startSubscribeUserDidTakeScreenshot().then(
        () => undefined,
        error => {
          runtimeScreenshotFeedbackSubscriptionPromise = undefined;
          throw error;
        },
      );
  }

  return runtimeScreenshotFeedbackSubscriptionPromise;
}
