import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import '@/core/native/RNTimeChanged';
import { IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';
import {
  getGlobalScreenCapturable,
  setGlobalScreenCapturable,
} from './screenCapturable';

export { getGlobalScreenCapturable };

type IosAppSwitcherBlurState = {
  visible: boolean;
};

const iosAppSwitcherBlurStore = zCreate<IosAppSwitcherBlurState>(() => ({
  visible: false,
}));

function setIOSAppSwitcherBlurVisible(visible: boolean) {
  iosAppSwitcherBlurStore.setState(prev => {
    if (prev.visible === visible) {
      return prev;
    }

    return {
      ...prev,
      visible,
    };
  });
}

export function useIOSAppSwitcherBlurVisible() {
  return iosAppSwitcherBlurStore(s => s.visible);
}

export function enableIOSAppSwitcherBlur() {
  if (!IS_IOS) {
    return;
  }

  RNScreenshotPrevent.setAppSwitcherBlurEnabled(true);
}

export function startSubscribeIOSAppSwitcherBlur() {
  if (!IS_IOS) {
    return;
  }

  return RNScreenshotPrevent.iosOnAppSwitcherBlurChanged(ctx => {
    setIOSAppSwitcherBlurVisible(!!ctx.visible);
  });
}

export function startSubscribeWhetherPreventScreenshot() {
  perfEvents.subscribe('CHANGE_PREVENT_SCREENSHOT', (isPrevented: boolean) => {
    setGlobalScreenCapturable(!isPrevented);
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
    if (!changed) {
      return prev;
    }

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
