import {
  enableIOSAppSwitcherBlur,
  startSubscribeIOSAppSwitcherBlur,
  startSubscribeWhetherPreventScreenshot,
} from '@/hooks/native/security';
import {
  startSubscribeAtSensitiveScene,
  startSubscribeIOSJustScreenshotted,
  startSubscribeIOSScreenRecording,
} from '@/hooks/native/sensitiveScene';

let runtimeSecuritySubscriptionsStarted = false;

export function startSetupRuntimeSecuritySubscriptions() {
  if (runtimeSecuritySubscriptionsStarted) {
    return;
  }
  runtimeSecuritySubscriptionsStarted = true;

  // Install the native consumer before the sensitive-scene publisher performs
  // its initial reconciliation, otherwise the first protection state is lost.
  startSubscribeWhetherPreventScreenshot();
  startSubscribeAtSensitiveScene();
  startSubscribeIOSJustScreenshotted();
  startSubscribeIOSAppSwitcherBlur();
  enableIOSAppSwitcherBlur();
  startSubscribeIOSScreenRecording();
}
