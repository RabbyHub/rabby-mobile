import {
  enableIOSAppSwitcherBlur,
  startSubscribeIOSAppSwitcherBlur,
  startSubscribeWhetherPreventScreenshot,
} from '@/hooks/native/security';
import {
  startSubscribeAtSensitiveScene,
  startSubscribeIOSJustScreenshotted,
  startSubscribeIOSScreenRecording,
} from '@/hooks/navigation';
import { startSubscribeUserDidTakeScreenshot } from '@/components/Screenshot/hooks';

export function startSetupRuntimeSecuritySubscriptions() {
  startSubscribeUserDidTakeScreenshot();
  startSubscribeAtSensitiveScene();
  startSubscribeIOSJustScreenshotted();
  startSubscribeIOSAppSwitcherBlur();
  enableIOSAppSwitcherBlur();
  startSubscribeWhetherPreventScreenshot();
  startSubscribeIOSScreenRecording();
}
