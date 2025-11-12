import { atom, useAtom } from 'jotai';

import { appJsonStore, atomByMMKV } from '../storage/mmkv';
import { useCallback, useEffect, useMemo } from 'react';
import { checkHostReachable } from './network';
import { formatDevURI } from '@/components/WebView/LocalWebView/utils';

const PERSIST_KEY = '@devServerSettings';

export function getDevServerHost() {
  return appJsonStore.getItem(PERSIST_KEY, {})?.devServerHost;
}

const devServerSettingsAtom = atomByMMKV(PERSIST_KEY, {
  /** @sample 192.168.0.1:9090 */
  devServerHost: '',
});
const devServerHostAvailableAtom = atom(false);

export function useDevServerSettings() {
  const [devServerSettings, setDevServerSettings] = useAtom(
    devServerSettingsAtom,
  );

  const setDevServerHost = useCallback(
    (devServerHost: string) => {
      setDevServerSettings(prev => {
        // if (devServerHost) {
        //   setTimeout(() => {
        //     setupReactotronConnection();
        //   }, 2000);
        // }
        return { ...prev, devServerHost };
      });
    },
    [setDevServerSettings],
  );

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
  const [available, setAvailable] = useAtom(devServerHostAvailableAtom);
  const [devServerSettings] = useAtom(devServerSettingsAtom);

  const { devUri } = useMemo(() => {
    const fallbackUri = formatDevURI({
      host: devServerSettings.devServerHost,
      port: 5173,
      protocol: 'http:',
    });
    const devUri =
      (!prop_devUri
        ? fallbackUri
        : typeof prop_devUri === 'function'
        ? prop_devUri({ devServerHost: devServerSettings.devServerHost })
        : prop_devUri) || fallbackUri;

    return {
      fallbackUri,
      devUri,
    };
  }, [devServerSettings.devServerHost, prop_devUri]);

  const detect = useCallback(async () => {
    if (!devServerSettings.devServerHost) {
      setAvailable(false);
      return;
    }

    const isReachable = await checkHostReachable(devUri);
    setAvailable(isReachable);
  }, [devUri, devServerSettings.devServerHost, setAvailable]);

  useEffect(() => {
    if (!autoDetectHost) return;

    detect();
  }, [autoDetectHost, detect]);

  return {
    devUri,
    devServerHost: devServerSettings.devServerHost,
    devServerMobileLocalPagesAvailable: available,
  };
}
