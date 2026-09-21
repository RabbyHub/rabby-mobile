import { startSubscribeUserDidTakeScreenshot } from '@/components/Screenshot/hooks';

let runtimeScreenshotFeedbackSubscriptionStarted = false;

export function startSetupRuntimeScreenshotFeedbackSubscription() {
  if (runtimeScreenshotFeedbackSubscriptionStarted) {
    return;
  }
  runtimeScreenshotFeedbackSubscriptionStarted = true;

  startSubscribeUserDidTakeScreenshot();
}
