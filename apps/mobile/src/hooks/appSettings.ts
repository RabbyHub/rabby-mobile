import DeviceUtils from '@/core/utils/device';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { isNonPublicProductionEnv } from '@/constant';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { zCreate } from '@/core/utils/reexports';
import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { apisAutoLock } from '@/core/apis';
import { preferenceService } from '@/core/services';
import { useMemo } from 'react';

const isIOS = DeviceUtils.isIOS();

type ScreenshotSettings = {
  androidForceAllowScreenCapture: boolean;
  iosForceAllowScreenRecord: boolean;
  timeTipAboutSeedPhraseAndPrivateKey: 'copy' | 'pasted' | 'none';
};
const experimentalSettingsStore = zustandByMMKV<ScreenshotSettings>(
  '@ExperimentalSettings',
  {
    /**
     * @description means screen-capture/screen-recording on Android, or screen-recording on iOS
     *
     * for iOS, change it need restart the app
     */
    androidForceAllowScreenCapture: false,
    iosForceAllowScreenRecord: false,

    timeTipAboutSeedPhraseAndPrivateKey: 'copy',
  },
);

export const storeApiExpSettingData = {
  set: setExpSettingData,
  get: getExpSettingData,
  getTimeTipAboutSeedPhraseAndPrivateKey: () => {
    if (!__DEV__) return 'pasted';

    return experimentalSettingsStore.getState()
      .timeTipAboutSeedPhraseAndPrivateKey;
  },
};

function setExpSettingData(valOrFunc: UpdaterOrPartials<ScreenshotSettings>) {
  experimentalSettingsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return { ...prev, ...newVal };
  });
}

function getExpSettingData() {
  return experimentalSettingsStore.getState();
}

const KEY = isIOS
  ? 'iosForceAllowScreenRecord'
  : 'androidForceAllowScreenCapture';
function isAllowScreenshot(
  ret: Pick<
    ScreenshotSettings,
    'androidForceAllowScreenCapture' | 'iosForceAllowScreenRecord'
  >,
) {
  return ret[KEY];
}

const onExpScreenCaptureChange = (partials: Partial<ScreenshotSettings>) => {
  setExpSettingData(prev => ({
    ...prev,
    ...partials,
  }));
};

const prodData = {
  androidForceAllowScreenCapture: false,
  iosForceAllowScreenRecord: false,
  forceAllowScreenshot: false,
  onExpScreenCaptureChange,
};
export function getExpScreenCapture(
  s: Pick<
    ScreenshotSettings,
    'androidForceAllowScreenCapture' | 'iosForceAllowScreenRecord'
  > = experimentalSettingsStore.getState(),
) {
  const { androidForceAllowScreenCapture, iosForceAllowScreenRecord } = s;

  if (!isNonPublicProductionEnv) {
    return prodData;
  }

  return {
    androidForceAllowScreenCapture,
    iosForceAllowScreenRecord,
    forceAllowScreenshot: isAllowScreenshot({
      androidForceAllowScreenCapture,
      iosForceAllowScreenRecord,
    }),
  };
}
export function useExpScreenCapture() {
  const {
    androidForceAllowScreenCapture,
    iosForceAllowScreenRecord,
    forceAllowScreenshot,
  } = experimentalSettingsStore(useShallow(s => getExpScreenCapture(s)));

  if (!isNonPublicProductionEnv) {
    return prodData;
  }

  return {
    androidForceAllowScreenCapture,
    iosForceAllowScreenRecord,
    forceAllowScreenshot,
    onExpScreenCaptureChange,
  };
}

const setAllowScreenshot = (
  valueOrFunc: boolean | ((prev: boolean) => boolean),
) => {
  setExpSettingData(prev => {
    const next =
      typeof valueOrFunc === 'function' ? valueOrFunc(prev[KEY]) : valueOrFunc;

    return {
      ...prev,
      [KEY]: next,
    };
  });
};

export function useForceAllowScreenshot() {
  const result = experimentalSettingsStore(
    useShallow(s => ({
      androidForceAllowScreenCapture: s.androidForceAllowScreenCapture,
      iosForceAllowScreenRecord: s.iosForceAllowScreenRecord,
    })),
  );

  return {
    androidForceAllowScreenCapture: result.androidForceAllowScreenCapture,
    iosForceAllowScreenRecord: result.iosForceAllowScreenRecord,
    forceAllowScreenshot: isAllowScreenshot(result),
    setAllowScreenshot,
  };
}

export function useTimeTipAboutSeedPhraseAndPrivateKey() {
  const timeTipAboutSeedPhraseAndPrivateKey = experimentalSettingsStore(
    s => s.timeTipAboutSeedPhraseAndPrivateKey,
  );

  return {
    timeTipAboutSeedPhraseAndPrivateKey: isNonPublicProductionEnv
      ? timeTipAboutSeedPhraseAndPrivateKey
      : 'none',
  };
}

const autoLockState = zCreate<{
  minutes: number;
}>(() => ({
  minutes:
    apisAutoLock.getPersistedAutoLockTimes()?.minutes ||
    DEFAULT_AUTO_LOCK_MINUTES,
}));
function setAutoLockMinutes(valOrFunc: UpdaterOrPartials<number>) {
  autoLockState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.minutes, valOrFunc);

    return { ...prev, minutes: newVal };
  });
}

runIIFEFunc(() => {
  const times = apisAutoLock.getPersistedAutoLockTimes();
  setAutoLockMinutes(times.minutes);
});

export function useAutoLockTimeMinites() {
  const autoLockMinutes = autoLockState(s => s.minutes);

  return { autoLockMinutes };
}

const onAutoLockTimeMsChange = (ms: number) => {
  const minutes = apisAutoLock.coerceAutoLockTimeout(ms).minutes;
  setAutoLockMinutes(minutes);
  preferenceService.setPreference({
    autoLockTime: minutes,
  });
  apisAutoLock.refreshAutolockTimeout();
};
export function useAutoLockTimeMs() {
  const autoLockMinutes = autoLockState(s => s.minutes);

  const autoLockMs = useMemo(
    () => autoLockMinutes * 60 * 1000,
    [autoLockMinutes],
  );

  return {
    autoLockMs,
    onAutoLockTimeMsChange,
  };
}

// const showFloatingViewAtom = atom({
//   collapsed: true,
//   ui_showAutoLockCountdown: false,
// });
const showFloatingViewStore = zCreate<{
  collapsed: boolean;
  ui_showAutoLockCountdown: boolean;
}>(() => ({
  collapsed: true,
  ui_showAutoLockCountdown: false,
}));
function setShowFloatingView(
  valOrFunc: UpdaterOrPartials<{
    collapsed: boolean;
    ui_showAutoLockCountdown: boolean;
  }>,
) {
  showFloatingViewStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return { ...prev, ...newVal };
  });
}

const toggleCollapsed = (nextEnabled?: boolean) => {
  setShowFloatingView(prev => {
    if (typeof nextEnabled !== 'boolean') {
      nextEnabled = !prev.collapsed;
    }
    return {
      ...prev,
      collapsed: nextEnabled,
    };
  });
};

export function useFloatingView() {
  const floatingView = showFloatingViewStore(s => s);

  return {
    collapsed: floatingView.collapsed,
    toggleCollapsed,
    shouldShow: Object.entries(floatingView).some(
      ([k, v]) => k.startsWith('ui_') && v,
    ),
  };
}

const toggleShowAutoLockCountdown = (nextEnabled?: boolean) => {
  setShowFloatingView(prev => {
    if (typeof nextEnabled !== 'boolean') {
      nextEnabled = !prev.ui_showAutoLockCountdown;
    }
    return {
      ...prev,
      ui_showAutoLockCountdown: nextEnabled,
    };
  });
};

export function useToggleShowAutoLockCountdown() {
  const ui_showAutoLockCountdown = showFloatingViewStore(
    s => s.ui_showAutoLockCountdown,
  );

  return {
    showAutoLockCountdown: ui_showAutoLockCountdown,
    toggleShowAutoLockCountdown,
  };
}

type MockBatchRevokeState = {
  DEBUG_MOCK_SUBMIT: boolean;
  DEBUG_ETH_GAS_USD_LIMIT: number;
  DEBUG_OTHER_CHAIN_GAS_USD_LIMIT: number;
  DEBUG_SIMULATION_FAILED: boolean;
};
export const mockBatchRevokeStore = zCreate<MockBatchRevokeState>(() => ({
  DEBUG_MOCK_SUBMIT: false,
  DEBUG_ETH_GAS_USD_LIMIT: 20,
  DEBUG_OTHER_CHAIN_GAS_USD_LIMIT: 5,
  DEBUG_SIMULATION_FAILED: false,
}));
function setMockBatchRevokeSetting(
  valOrFunc: UpdaterOrPartials<MockBatchRevokeState>,
) {
  mockBatchRevokeStore.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}
const setMockBatchRevoke = (
  key: keyof MockBatchRevokeState,
  value: boolean | number,
) => {
  setMockBatchRevokeSetting(prev => ({
    ...prev,
    [key]: value,
  }));
};
export function useMockBatchRevoke() {
  const mockBatchRevokeSetting = mockBatchRevokeStore(s => s);

  return {
    mockBatchRevokeSetting,
    setMockBatchRevoke,
  };
}
