import type { AppRootName } from '@/constant/layout';
import { RootNames } from '@/constant/layout';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { IS_IOS } from '@/core/native/utils';
import { perfEvents } from '@/core/utils/perf';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import {
  atSensitiveSceneState,
  bottomSheetModalSecurityApis,
} from '@/components2024/GlobalBottomSheetModal/security';
import {
  getExpScreenCapture,
  useIosForceDisableAlertForSensitiveScene,
} from '@/hooks/appSettings';
import { getLatestNavigationName } from '@/utils/navigation';
import { useShallow } from 'zustand/react/shallow';
import { setIOSScreenCapture } from './security';

type SensitiveSceneNavigation = {
  goBack: () => void;
};

export const enum ProtectType {
  NONE = 0,
  SafeTipModal = 1,
}

export type ProtectedConf = {
  iosBlurType: ProtectType | null;
  warningScreenshotBackup: boolean;
  onOk?: (ctx: { navigation?: SensitiveSceneNavigation | null }) => void;
};

const defaultOnOk: NonNullable<ProtectedConf['onOk']> = ctx => {
  ctx.navigation?.goBack();
};

const defaultProtectedConf: ProtectedConf = {
  iosBlurType: ProtectType.NONE,
  onOk: defaultOnOk,
  warningScreenshotBackup: false,
};

function getProtectedConf(): ProtectedConf {
  return {
    ...defaultProtectedConf,
    warningScreenshotBackup: true,
    iosBlurType: ProtectType.SafeTipModal,
  };
}

const PROTECTED_SCREENS: {
  [P in AppRootName]?: ProtectedConf;
} = {
  [RootNames.CreateMnemonic]: getProtectedConf(),
  [RootNames.ImportMnemonic]: getProtectedConf(),
  [RootNames.ImportPrivateKey]: getProtectedConf(),
  [RootNames.ImportMnemonic2024]: getProtectedConf(),
  [RootNames.ImportPrivateKey2024]: getProtectedConf(),
  [RootNames.CreateMnemonicBackup]: getProtectedConf(),
  [RootNames.CreateMnemonicVerify]: getProtectedConf(),
  [RootNames.BackupPrivateKey]: getProtectedConf(),
  [RootNames.ImportSecret]: getProtectedConf(),
};

function getAtSensitiveScreenInfo(routeName: string | undefined) {
  const result = {
    $protectedConf: { ...defaultProtectedConf },
    _atSensitiveScreen: false,
  };

  if (!routeName || !PROTECTED_SCREENS[routeName]) {
    return result;
  }

  result.$protectedConf = {
    ...defaultProtectedConf,
    ...PROTECTED_SCREENS[routeName],
  };
  result._atSensitiveScreen = true;

  return result;
}

type AtSensitiveScreenInfo = ReturnType<typeof getAtSensitiveScreenInfo>;
type AtSensitiveScreenState = {
  anySensitiveModalOpened: boolean;
  screenInfo: AtSensitiveScreenInfo;
};

const atSensitiveScreenStore = zCreate<AtSensitiveScreenState>(() => ({
  anySensitiveModalOpened: false,
  screenInfo: getAtSensitiveScreenInfo(undefined),
}));

function setAtSensitiveScreenInfo(
  valOrFunc: UpdaterOrPartials<AtSensitiveScreenInfo>,
) {
  atSensitiveScreenStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.screenInfo,
      valOrFunc,
      {
        strict: true,
      },
    );

    if (!changed) {
      return prev;
    }

    return { ...prev, screenInfo: newVal };
  });
}

perfEvents.addListener('EVENT_ROUTE_CHANGE', ({ currentRouteName }) => {
  setAtSensitiveScreenInfo(getAtSensitiveScreenInfo(currentRouteName));
});

function syncSensitiveModalState(s = atSensitiveSceneState.getState()) {
  const anySensitiveModalOpened =
    bottomSheetModalSecurityApis.isAnySensitiveModalOpened(s);

  atSensitiveScreenStore.setState(prev => {
    if (prev.anySensitiveModalOpened === anySensitiveModalOpened) {
      return prev;
    }

    return {
      ...prev,
      anySensitiveModalOpened,
    };
  });
}

atSensitiveSceneState.subscribe(syncSensitiveModalState);

export function useAtSensitiveScene() {
  const { iosForceDisableAlertForSensitiveScene } =
    useIosForceDisableAlertForSensitiveScene();

  return atSensitiveScreenStore(
    useShallow(s => {
      const ret = getAtSensitiveScene(s);

      if (iosForceDisableAlertForSensitiveScene) {
        ret.atSensitiveScene = false;
        ret.iosBlurType = ProtectType.NONE;
        ret.warningScreenshotBackup = false;
      }

      return ret;
    }),
  );
}

export function getAtSensitiveScene(s = atSensitiveScreenStore.getState()) {
  const srnInfo = s.screenInfo;
  const anySensitiveModalOpened = s.anySensitiveModalOpened;

  return {
    anySensitiveModalOpened,
    atSensitiveScene: srnInfo._atSensitiveScreen || anySensitiveModalOpened,
    iosBlurType: srnInfo.$protectedConf.iosBlurType,
    warningScreenshotBackup: srnInfo.$protectedConf.warningScreenshotBackup,
    onOk: srnInfo.$protectedConf.onOk,
  };
}

function syncSensitiveSceneScreenCaptureProtection(
  state = atSensitiveScreenStore.getState(),
) {
  const shouldPreventScreenCapturing =
    getAtSensitiveScene(state).atSensitiveScene &&
    !getExpScreenCapture().forceAllowScreenshot;

  perfEvents.emit('CHANGE_PREVENT_SCREENSHOT', shouldPreventScreenCapturing);
}

export function startSubscribeAtSensitiveScene() {
  // Navigation or a protected modal may already be active by the time the
  // launch task loads. Subscriptions only observe future changes, so reconcile
  // all current inputs before publishing the native protection state.
  setAtSensitiveScreenInfo(getAtSensitiveScreenInfo(getLatestNavigationName()));
  syncSensitiveModalState();

  const unsubscribe = atSensitiveScreenStore.subscribe(
    syncSensitiveSceneScreenCaptureProtection,
  );
  syncSensitiveSceneScreenCaptureProtection();

  return unsubscribe;
}

export function startSubscribeIOSJustScreenshotted() {
  return RNScreenshotPrevent.onUserDidTakeScreenshot(() => {
    const setScreenshotted = (val?: boolean) =>
      setIOSScreenCapture(prev => ({ ...prev, isScreenshotJustNow: !!val }));

    setScreenshotted(getAtSensitiveScene().warningScreenshotBackup);
  });
}

export function startSubscribeIOSScreenRecording() {
  if (!IS_IOS && !__DEV__) {
    return;
  }

  return RNScreenshotPrevent.iosOnScreenCaptureChanged(ctx => {
    setIOSScreenCapture(prev => ({
      ...prev,
      isBeingCaptured: ctx.isBeingCaptured,
    }));

    const atSensitiveInfo = getAtSensitiveScene();
    if (atSensitiveInfo.iosBlurType === ProtectType.SafeTipModal) {
      return;
    }

    const shouldPreventScreenCapturing =
      atSensitiveInfo.atSensitiveScene &&
      !getExpScreenCapture().forceAllowScreenshot;

    if (ctx.isBeingCaptured && shouldPreventScreenCapturing) {
      RNScreenshotPrevent.iosProtectFromScreenRecording();
    } else {
      RNScreenshotPrevent.iosUnprotectFromScreenRecording();
    }
  });
}
