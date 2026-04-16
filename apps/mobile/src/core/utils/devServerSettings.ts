import { appJsonStore, zustandByMMKV } from '../storage/mmkv';
import { useCallback, useEffect, useMemo } from 'react';
import { checkHostReachable } from './network';
import { formatDevURI } from '@/components/WebView/LocalWebView/utils';
import { resolveValFromUpdater, UpdaterOrPartials } from './store';

const PERSIST_KEY = '@devServerSettings';

/** Dev server usage scenes */
export enum DevServerScene {
  LOCAL_WEBVIEW = 'localWebView',
  REACTOTRON = 'reactotron',
  FE_PUSH_SERVICE = 'fePushService',
}

/** @deprecated Use DevServerScene instead */
export const DEV_SERVER_SCENES = DevServerScene;

type DevServerHostState = {
  /** @sample 192.168.0.1:9090 */
  devServerHost: string;
  devServerHostAvailable: boolean;
};

type DevServerHostsMap = {
  [DevServerScene.LOCAL_WEBVIEW]: DevServerHostState;
  [DevServerScene.REACTOTRON]: DevServerHostState;
  [DevServerScene.FE_PUSH_SERVICE]: DevServerHostState;
};

type DevServerSettingsState = {
  /** @deprecated Use devServerHosts instead */
  devServerHost: string;
  /** @deprecated Use devServerHosts instead */
  devServerHostAvailable: boolean;
  /** Scene-specific dev server hosts */
  devServerHosts: DevServerHostsMap;
};

const DEFAULT_HOST_STATE: DevServerHostState = {
  devServerHost: '',
  devServerHostAvailable: false,
};

const devServerSettingsStore = zustandByMMKV<DevServerSettingsState>(
  PERSIST_KEY,
  {
    devServerHost: '',
    devServerHostAvailable: false,
    devServerHosts: {
      [DevServerScene.LOCAL_WEBVIEW]: { ...DEFAULT_HOST_STATE },
      [DevServerScene.REACTOTRON]: { ...DEFAULT_HOST_STATE },
      [DevServerScene.FE_PUSH_SERVICE]: { ...DEFAULT_HOST_STATE },
    },
  },
);

/** Get dev server host for a specific scene */
export function getDevServerHost(
  scene: DevServerScene = DevServerScene.LOCAL_WEBVIEW,
): string {
  return devServerSettingsStore.getState().devServerHosts[scene].devServerHost;
}

/** @deprecated Use getDevServerHost(scene) instead */
export function getDevServerHostLegacy(): string {
  return devServerSettingsStore.getState().devServerHost;
}

function setDevServerStore(
  valOrFunc: UpdaterOrPartials<DevServerSettingsState>,
) {
  devServerSettingsStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return { ...prev, ...newVal };
  });
}

/** Set dev server host for a specific scene */
export const setDevServerHost = (
  scene: DevServerScene,
  devServerHost: string,
) => {
  setDevServerStore(prev => {
    return {
      ...prev,
      devServerHosts: {
        ...prev.devServerHosts,
        [scene]: {
          ...prev.devServerHosts[scene],
          devServerHost,
        },
      },
      // Also update legacy field for backward compatibility
      devServerHost,
    };
  });
};

/** Check and update availability for a specific scene */
const checkAndUpdateAvailability = async (
  scene: DevServerScene,
  host: string,
  checkFn?: (host: string) => Promise<boolean>,
) => {
  if (!host) {
    setDevServerStore(prev => ({
      ...prev,
      devServerHosts: {
        ...prev.devServerHosts,
        [scene]: {
          ...prev.devServerHosts[scene],
          devServerHostAvailable: false,
        },
      },
    }));
    return false;
  }

  const isReachable = checkFn
    ? await checkFn(host)
    : await checkHostReachable(host);

  setDevServerStore(prev => ({
    ...prev,
    devServerHosts: {
      ...prev.devServerHosts,
      [scene]: {
        ...prev.devServerHosts[scene],
        devServerHostAvailable: isReachable,
      },
    },
    // Also update legacy field for backward compatibility
    devServerHostAvailable: isReachable,
  }));

  return isReachable;
};

/** Hook to get dev server settings */
export function useDevServerSettings() {
  const devServerSettings = devServerSettingsStore(s => s);

  return {
    devServerSettings,
    setDevServerHost,
    getSceneHost: (scene: DevServerScene) =>
      devServerSettings.devServerHosts[scene],
  };
}

export type GetDevUriFn = (ctx: { devServerHost: string }) => string;

/** Hook for LocalWebView scene */
export function useDevServerHostAvailableForLocalWebView({
  autoDetectHost = true,
  devUri: prop_devUri,
}: {
  autoDetectHost?: boolean;
  devUri?: string | GetDevUriFn;
} = {}) {
  const scene = DevServerScene.LOCAL_WEBVIEW;
  const hostState = devServerSettingsStore(s => s.devServerHosts[scene]);
  const devServerHost = hostState.devServerHost;
  const available = hostState.devServerHostAvailable;

  const { devUri } = useMemo(() => {
    const fallbackUri = formatDevURI({
      host: devServerHost,
      port: 5173,
      protocol: 'http:',
    });
    const devUri =
      (!prop_devUri
        ? fallbackUri
        : typeof prop_devUri === 'function'
        ? prop_devUri({ devServerHost: devServerHost })
        : prop_devUri) || fallbackUri;

    return {
      fallbackUri,
      devUri,
    };
  }, [devServerHost, prop_devUri]);

  const detect = useCallback(async () => {
    await checkAndUpdateAvailability(scene, devUri);
  }, [scene, devUri]);

  useEffect(() => {
    if (!autoDetectHost) return;

    detect();
  }, [autoDetectHost, detect]);

  return {
    devUri,
    devServerHost,
    devServerMobileLocalPagesAvailable: available,
  };
}

/** Hook for Reactotron scene */
export function useDevServerHostForReactotron() {
  const hostState = devServerSettingsStore(
    s => s.devServerHosts[DevServerScene.REACTOTRON],
  );

  return {
    devServerHost: hostState.devServerHost,
    setDevServerHost: (host: string) =>
      setDevServerHost(DevServerScene.REACTOTRON, host),
  };
}

/** Hook for FE Push Service scene */
export function useDevServerHostForFePushService() {
  const hostState = devServerSettingsStore(
    s => s.devServerHosts[DevServerScene.FE_PUSH_SERVICE],
  );

  return {
    devServerHost: hostState.devServerHost,
    devServerHostAvailable: hostState.devServerHostAvailable,
    setDevServerHost: (host: string) =>
      setDevServerHost(DevServerScene.FE_PUSH_SERVICE, host),
  };
}

/** @deprecated Use useDevServerHostAvailableForLocalWebView instead */
export function useDevServerHostAvailable({
  autoDetectHost = true,
  devUri: prop_devUri,
}: {
  autoDetectHost?: boolean;
  devUri?: string | GetDevUriFn;
} = {}) {
  return useDevServerHostAvailableForLocalWebView({
    autoDetectHost,
    devUri: prop_devUri,
  });
}
