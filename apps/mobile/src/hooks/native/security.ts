import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import '@/core/native/RNTimeChanged';
import { IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';

const globalScreenCapturableRef = { current: true };
export function getGlobalScreenCapturable() {
  return globalScreenCapturableRef.current;
}

export function startSubscribeWhetherPreventScreenshot() {
  perfEvents.subscribe('CHANGE_PREVENT_SCREENSHOT', (isPrevented: boolean) => {
    globalScreenCapturableRef.current = !isPrevented;
    if (!isPrevented) {
      RNScreenshotPrevent.togglePreventScreenshot(false);
      return;
    }

    RNScreenshotPrevent.togglePreventScreenshot(true);

    return () => {
      RNScreenshotPrevent.togglePreventScreenshot(false);
    };
  });
}

type IosScreenCaptureState = {
  isBeingCaptured: boolean;
  isScreenshotJustNow: boolean;
};
const iosScreenCaptureStore = zCreate<IosScreenCaptureState>(() => ({
  isBeingCaptured: IS_IOS ? RNScreenshotPrevent.iosIsBeingCaptured() : false,
  isScreenshotJustNow: false,
}));

export function setIOSScreenCapture(
  valOrFunc: UpdaterOrPartials<IosScreenCaptureState>,
) {
  iosScreenCaptureStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });
    if (!changed) return prev;

    return { ...prev, ...newVal };
  });
}

export function useIOSScreenIsBeingCaptured() {
  const isBeingCaptured = iosScreenCaptureStore(s => s.isBeingCaptured);

  return {
    isBeingCaptured,
  };
}

export const clearScreenshotJustNow = () => {
  setIOSScreenCapture(prev => ({ ...prev, isScreenshotJustNow: false }));
};

export function useIOSScreenshottedJustNow() {
  const isScreenshotJustNow = iosScreenCaptureStore(s => s.isScreenshotJustNow);

  return {
    isScreenshotJustNow,
    clearScreenshotJustNow,
  };
}

export const storeApiSecurity = {
  setIOSScreenCapture,
  clearScreenshotJustNow,
};
