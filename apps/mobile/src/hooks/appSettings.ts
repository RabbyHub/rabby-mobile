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
import * as apisAutoLock from '@/core/apis/autoLock';
import {
  KEYCHAIN_STORAGE_TYPES,
  DEFAULT_KEYCHAIN_STORAGE_TYPE,
  coerceKeychainStorageType,
  type KeychainStorageType,
} from '@/core/apis/keychainCommon';
import { preferenceService } from '@/core/services';
import { useCallback, useMemo } from 'react';

const isIOS = DeviceUtils.isIOS();

export const CURRENT_KEYCHAIN_VERSION_VALUES = [
  '8.2.0-fork',
  '9.0.0',
  '10.0.0',
] as const;

export type CurrentKeychainVersion =
  (typeof CURRENT_KEYCHAIN_VERSION_VALUES)[number];

export const DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD =
  'debugCurrentKeychainVersion20260528' as const;

const DEFAULT_CURRENT_KEYCHAIN_VERSION: CurrentKeychainVersion = '10.0.0';
const DEFAULT_DEBUG_KEYCHAIN_STORAGE: KeychainStorageType =
  DEFAULT_KEYCHAIN_STORAGE_TYPE;
export const WIDE_SCREEN_DEBUG_PANEL_DEFAULT_MIN_WIDTH = 700;
export const WIDE_SCREEN_DEBUG_PANEL_MIN_ALLOWED_WIDTH = 280;
export const WIDE_SCREEN_DEBUG_PANEL_WIDTH = 320;

function coerceCurrentKeychainVersion(
  version: unknown,
): CurrentKeychainVersion {
  return CURRENT_KEYCHAIN_VERSION_VALUES.includes(
    version as CurrentKeychainVersion,
  )
    ? (version as CurrentKeychainVersion)
    : DEFAULT_CURRENT_KEYCHAIN_VERSION;
}

function coerceWideScreenDebugPanelMinWidth(value: unknown) {
  const width = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(width)) {
    return WIDE_SCREEN_DEBUG_PANEL_DEFAULT_MIN_WIDTH;
  }

  return Math.max(WIDE_SCREEN_DEBUG_PANEL_MIN_ALLOWED_WIDTH, Math.round(width));
}

type DebugKeychainStorageByVersion = Record<
  CurrentKeychainVersion,
  KeychainStorageType
>;

function makeDefaultDebugKeychainStorageByVersion(): DebugKeychainStorageByVersion {
  return {
    '8.2.0-fork': DEFAULT_DEBUG_KEYCHAIN_STORAGE,
    '9.0.0': DEFAULT_DEBUG_KEYCHAIN_STORAGE,
    '10.0.0': DEFAULT_DEBUG_KEYCHAIN_STORAGE,
  };
}

function coerceDebugKeychainStorageByVersion(
  value: unknown,
): DebugKeychainStorageByVersion {
  const raw =
    value && typeof value === 'object'
      ? (value as Partial<Record<CurrentKeychainVersion, unknown>>)
      : null;

  return {
    '8.2.0-fork': coerceKeychainStorageType(raw?.['8.2.0-fork']),
    '9.0.0': coerceKeychainStorageType(raw?.['9.0.0']),
    '10.0.0': coerceKeychainStorageType(raw?.['10.0.0']),
  };
}

type ScreenshotSettings = {
  androidForceAllowScreenCapture: boolean;
  iosForceAllowScreenRecord: boolean;
  iosForceDisableAlertForSensitiveScene: boolean;
  timeTipAboutSeedPhraseAndPrivateKey: 'copy' | 'pasted' | 'none';
  blockSubmitIfFormChangedOnAuth: boolean;
  toastOpenApiHttpErrorStatus: boolean;
  debugSwapHistorySkipLocalLookup: boolean;
  wideScreenDebugPanelEnabled: boolean;
  wideScreenDebugPanelMinWidth: number;
  [DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD]: CurrentKeychainVersion;
  debugKeychainStorageByVersion: DebugKeychainStorageByVersion;
  enablePerpsWatchAddress: boolean;
};
const experimentalSettingsStore = zustandByMMKV<ScreenshotSettings>(
  '@ExperimentalSettings',
  {
    /**
     * @description means screen-capture/screen-recording on Android, or screen-recording on iOS
     *
     * for iOS, change it need restart the app
     */
    androidForceAllowScreenCapture: isNonPublicProductionEnv,
    iosForceAllowScreenRecord: isNonPublicProductionEnv,
    iosForceDisableAlertForSensitiveScene: isNonPublicProductionEnv,

    timeTipAboutSeedPhraseAndPrivateKey: 'copy',
    blockSubmitIfFormChangedOnAuth: false,
    toastOpenApiHttpErrorStatus: false,
    debugSwapHistorySkipLocalLookup: false,
    wideScreenDebugPanelEnabled: false,
    wideScreenDebugPanelMinWidth: WIDE_SCREEN_DEBUG_PANEL_DEFAULT_MIN_WIDTH,
    [DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD]: DEFAULT_CURRENT_KEYCHAIN_VERSION,
    debugKeychainStorageByVersion: makeDefaultDebugKeychainStorageByVersion(),
    enablePerpsWatchAddress: false,
  },
);

export const storeApiExpSettingData = {
  set: setExpSettingData,
  get: getExpSettingData,
  getCurrentKeychainVersion,
  getDebugKeychainStorageByVersion,
  getShouldBlockSubmitIfFormChangedOnAuth,
  getTimeTipAboutSeedPhraseAndPrivateKey: () => {
    if (!__DEV__) {
      return 'pasted';
    }

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

export function getCurrentKeychainVersion(): CurrentKeychainVersion {
  if (!isNonPublicProductionEnv) {
    return DEFAULT_CURRENT_KEYCHAIN_VERSION;
  }

  return coerceCurrentKeychainVersion(
    experimentalSettingsStore.getState()[DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD],
  );
}

export function setCurrentKeychainVersion(version: CurrentKeychainVersion) {
  const nextVersion = coerceCurrentKeychainVersion(version);

  if (!isNonPublicProductionEnv) {
    return DEFAULT_CURRENT_KEYCHAIN_VERSION;
  }

  setExpSettingData(prev => ({
    ...prev,
    [DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD]: nextVersion,
  }));

  return nextVersion;
}

export function getDebugKeychainStorageByVersion(): DebugKeychainStorageByVersion {
  return coerceDebugKeychainStorageByVersion(
    experimentalSettingsStore.getState().debugKeychainStorageByVersion,
  );
}

export function getDebugKeychainStorageForVersion(
  version: CurrentKeychainVersion,
): KeychainStorageType {
  return getDebugKeychainStorageByVersion()[version];
}

export function setDebugKeychainStorageForVersion(
  version: CurrentKeychainVersion,
  storage: KeychainStorageType,
) {
  const nextStorage = coerceKeychainStorageType(storage);

  if (!isNonPublicProductionEnv) {
    return DEFAULT_DEBUG_KEYCHAIN_STORAGE;
  }

  setExpSettingData(prev => ({
    ...prev,
    debugKeychainStorageByVersion: {
      ...coerceDebugKeychainStorageByVersion(
        prev.debugKeychainStorageByVersion,
      ),
      [version]: nextStorage,
    },
  }));

  return nextStorage;
}

function getShouldBlockSubmitIfFormChangedOnAuth() {
  return __DEV__ && getExpSettingData().blockSubmitIfFormChangedOnAuth;
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
  iosForceDisableAlertForSensitiveScene: false,
  forceAllowScreenshot: false,
  onExpScreenCaptureChange,
};
export function getExpScreenCapture(
  s: Pick<
    ScreenshotSettings,
    | 'androidForceAllowScreenCapture'
    | 'iosForceAllowScreenRecord'
    | 'iosForceDisableAlertForSensitiveScene'
  > = experimentalSettingsStore.getState(),
) {
  const {
    androidForceAllowScreenCapture,
    iosForceAllowScreenRecord,
    iosForceDisableAlertForSensitiveScene,
  } = s;

  if (!isNonPublicProductionEnv) {
    return prodData;
  }

  return {
    androidForceAllowScreenCapture,
    iosForceAllowScreenRecord,
    iosForceDisableAlertForSensitiveScene,
    forceAllowScreenshot: isAllowScreenshot({
      androidForceAllowScreenCapture,
      iosForceAllowScreenRecord,
    }),
  };
}

export function useIosForceDisableAlertForSensitiveScene() {
  const iosForceDisableAlertForSensitiveScene = experimentalSettingsStore(
    s => s.iosForceDisableAlertForSensitiveScene,
  );

  const toggleIosForceDisableAlertForSensitiveScene = useCallback(
    (nextVal?: boolean) => {
      setExpSettingData(prev => ({
        ...prev,
        iosForceDisableAlertForSensitiveScene:
          typeof nextVal === 'boolean'
            ? nextVal
            : !prev.iosForceDisableAlertForSensitiveScene,
      }));
    },
    [],
  );

  return {
    iosForceDisableAlertForSensitiveScene,
    toggleIosForceDisableAlertForSensitiveScene,
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

export function useBlockSubmitIfFormChangedOnAuth() {
  const blockSubmitIfFormChangedOnAuth = experimentalSettingsStore(
    s => s.blockSubmitIfFormChangedOnAuth,
  );

  const toggleBlockSubmitIfFormChangedOnAuth = useCallback(
    (nextVal?: boolean) => {
      setExpSettingData(prev => ({
        ...prev,
        blockSubmitIfFormChangedOnAuth:
          typeof nextVal === 'boolean'
            ? nextVal
            : !prev.blockSubmitIfFormChangedOnAuth,
      }));
    },
    [],
  );

  return {
    blockSubmitIfFormChangedOnAuth,
    toggleBlockSubmitIfFormChangedOnAuth,
  };
}

export function useToastOpenApiHttpErrorStatus() {
  const toastOpenApiHttpErrorStatus = experimentalSettingsStore(
    s => s.toastOpenApiHttpErrorStatus,
  );

  const toggleToastOpenApiHttpErrorStatus = useCallback((nextVal?: boolean) => {
    if (!isNonPublicProductionEnv) {
      return false;
    }

    let finalValue = false;
    setExpSettingData(prev => {
      finalValue =
        typeof nextVal === 'boolean'
          ? nextVal
          : !prev.toastOpenApiHttpErrorStatus;

      return {
        ...prev,
        toastOpenApiHttpErrorStatus: finalValue,
      };
    });

    return finalValue;
  }, []);

  return {
    toastOpenApiHttpErrorStatus: isNonPublicProductionEnv
      ? toastOpenApiHttpErrorStatus
      : false,
    toggleToastOpenApiHttpErrorStatus,
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

const floatingUnlockStatusBarStore = zustandByMMKV<{
  enabled: boolean;
}>('@FloatingUnlockStatusBar', {
  enabled: false,
});

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
  const showUnlockStatusBar = floatingUnlockStatusBarStore(
    s => isNonPublicProductionEnv && s.enabled,
  );

  return {
    collapsed: floatingView.collapsed,
    showAutoLockCountdown: floatingView.ui_showAutoLockCountdown,
    showUnlockStatusBar,
    toggleCollapsed,
    shouldShow:
      showUnlockStatusBar ||
      Object.entries(floatingView).some(([k, v]) => k.startsWith('ui_') && v),
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

const toggleShowUnlockStatusBar = (nextEnabled?: boolean) => {
  if (!isNonPublicProductionEnv) {
    return false;
  }

  let finalValue = false;
  floatingUnlockStatusBarStore.setState(prev => {
    if (typeof nextEnabled !== 'boolean') {
      nextEnabled = !prev.enabled;
    }

    finalValue = nextEnabled;

    return {
      ...prev,
      enabled: finalValue,
    };
  });

  return finalValue;
};

export function useToggleShowUnlockStatusBar() {
  const showUnlockStatusBar = floatingUnlockStatusBarStore(
    s => isNonPublicProductionEnv && s.enabled,
  );

  return {
    showUnlockStatusBar,
    toggleShowUnlockStatusBar,
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

export function useDebugSwapHistorySkipLocalLookup() {
  const debugSwapHistorySkipLocalLookup = experimentalSettingsStore(
    s => s.debugSwapHistorySkipLocalLookup,
  );

  const toggleDebugSwapHistorySkipLocalLookup = useCallback(
    (nextVal?: boolean) => {
      setExpSettingData(prev => ({
        ...prev,
        debugSwapHistorySkipLocalLookup:
          typeof nextVal === 'boolean'
            ? nextVal
            : !prev.debugSwapHistorySkipLocalLookup,
      }));
    },
    [],
  );

  return {
    debugSwapHistorySkipLocalLookup,
    toggleDebugSwapHistorySkipLocalLookup,
  };
}

export function useWideScreenDebugPanelSetting() {
  const { wideScreenDebugPanelEnabled, wideScreenDebugPanelMinWidth } =
    experimentalSettingsStore(
      useShallow(s => ({
        wideScreenDebugPanelEnabled: s.wideScreenDebugPanelEnabled,
        wideScreenDebugPanelMinWidth: s.wideScreenDebugPanelMinWidth,
      })),
    );

  const appliedWideScreenDebugPanelMinWidth =
    coerceWideScreenDebugPanelMinWidth(wideScreenDebugPanelMinWidth);

  const setWideScreenDebugPanelMinWidth = useCallback((nextWidth: unknown) => {
    const coercedWidth = coerceWideScreenDebugPanelMinWidth(nextWidth);
    setExpSettingData(prev => ({
      ...prev,
      wideScreenDebugPanelMinWidth: coercedWidth,
    }));

    return coercedWidth;
  }, []);

  const toggleWideScreenDebugPanel = useCallback((nextVal?: boolean) => {
    setExpSettingData(prev => ({
      ...prev,
      wideScreenDebugPanelEnabled:
        typeof nextVal === 'boolean'
          ? nextVal
          : !prev.wideScreenDebugPanelEnabled,
    }));
  }, []);

  return {
    wideScreenDebugPanelEnabled:
      isNonPublicProductionEnv && wideScreenDebugPanelEnabled,
    wideScreenDebugPanelMinWidth: isNonPublicProductionEnv
      ? appliedWideScreenDebugPanelMinWidth
      : WIDE_SCREEN_DEBUG_PANEL_DEFAULT_MIN_WIDTH,
    wideScreenDebugPanelMinAllowedWidth:
      WIDE_SCREEN_DEBUG_PANEL_MIN_ALLOWED_WIDTH,
    setWideScreenDebugPanelMinWidth,
    toggleWideScreenDebugPanel,
  };
}

export function useEnablePerpsWatchAddress() {
  const enablePerpsWatchAddress = experimentalSettingsStore(
    s => s.enablePerpsWatchAddress,
  );

  const toggleEnablePerpsWatchAddress = useCallback((nextVal?: boolean) => {
    setExpSettingData(prev => ({
      ...prev,
      enablePerpsWatchAddress:
        typeof nextVal === 'boolean' ? nextVal : !prev.enablePerpsWatchAddress,
    }));
  }, []);

  return {
    enablePerpsWatchAddress:
      isNonPublicProductionEnv && enablePerpsWatchAddress,
    toggleEnablePerpsWatchAddress,
  };
}

export function useCurrentKeychainVersion() {
  const debugCurrentKeychainVersion = experimentalSettingsStore(
    s => s[DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD],
  );

  const setDebugCurrentKeychainVersion = useCallback(
    (nextVersion: CurrentKeychainVersion) => {
      return setCurrentKeychainVersion(nextVersion);
    },
    [],
  );

  return {
    currentKeychainVersion: getCurrentKeychainVersion(),
    debugCurrentKeychainVersion: coerceCurrentKeychainVersion(
      debugCurrentKeychainVersion,
    ),
    canSwitchCurrentKeychainVersion: isNonPublicProductionEnv,
    setCurrentKeychainVersion: setDebugCurrentKeychainVersion,
    currentKeychainVersionOptions: CURRENT_KEYCHAIN_VERSION_VALUES,
    debugCurrentKeychainVersionField: DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD,
  };
}

export function useDebugKeychainStorage() {
  const debugKeychainStorageByVersion = experimentalSettingsStore(
    s => s.debugKeychainStorageByVersion,
  );

  const setStorageForVersion = useCallback(
    (version: CurrentKeychainVersion, nextStorage: KeychainStorageType) => {
      return setDebugKeychainStorageForVersion(version, nextStorage);
    },
    [],
  );

  return {
    debugKeychainStorageByVersion: coerceDebugKeychainStorageByVersion(
      debugKeychainStorageByVersion,
    ),
    canSwitchDebugKeychainStorage: isNonPublicProductionEnv,
    setDebugKeychainStorageForVersion: setStorageForVersion,
    debugKeychainStorageOptions: [
      KEYCHAIN_STORAGE_TYPES.RSA,
      KEYCHAIN_STORAGE_TYPES.AES,
      KEYCHAIN_STORAGE_TYPES.AES_GCM,
      KEYCHAIN_STORAGE_TYPES.KC,
    ] as KeychainStorageType[],
  };
}
