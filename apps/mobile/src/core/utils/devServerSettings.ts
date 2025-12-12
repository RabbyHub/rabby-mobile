import { appJsonStore, zustandByMMKV } from '../storage/mmkv';
import { useCallback, useEffect, useMemo } from 'react';
import { checkHostReachable } from './network';
import { formatDevURI } from '@/components/WebView/LocalWebView/utils';
import { resolveValFromUpdater, UpdaterOrPartials } from './store';

const PERSIST_KEY = '@devServerSettings';

type DevServerHostState = {
  /** @sample 192.168.0.1:9090 */
  devServerHost: string;
  devServerHostAvailable: boolean;
};

const devServerSettingsStotre = zustandByMMKV<DevServerHostState>(PERSIST_KEY, {
  devServerHost: '',
  devServerHostAvailable: false,
});

export function getDevServerHost() {
  return devServerSettingsStotre.getState().devServerHost;
}

function setDevServerStore(valOrFunc: UpdaterOrPartials<DevServerHostState>) {
  devServerSettingsStotre.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return { ...prev, ...newVal };
  });
}

const setDevServerHost = (devServerHost: string) => {
  setDevServerStore(prev => {
    return { ...prev, devServerHost };
  });
};

export function useDevServerSettings() {
  const devServerSettings = devServerSettingsStotre(s => s);

  return { devServerSettings, setDevServerHost };
}

export type GetDevUriFn = (ctx: { devServerHost: string }) => string;
export function useDevServerHostAvailable({
  autoDetectHost = true,
  devUri: prop_devUri,
}: {
  autoDetectHost?: boolean;
  devUri?: string | GetDevUriFn;
} = {}) {
  const available = devServerSettingsStotre(s => s.devServerHostAvailable);
  const devServerHost = devServerSettingsStotre(s => s.devServerHost);

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
    if (!devServerHost) {
      setDevServerStore({ devServerHostAvailable: false });
      return;
    }

    const isReachable = await checkHostReachable(devUri);
    setDevServerStore({ devServerHostAvailable: isReachable });
  }, [devUri, devServerHost]);

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
