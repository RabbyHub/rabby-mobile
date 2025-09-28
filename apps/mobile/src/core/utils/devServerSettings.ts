import { useAtom } from 'jotai';

import { appJsonStore, atomByMMKV } from '../storage/mmkv';
import { useCallback } from 'react';

const PERSIST_KEY = '@devServerSettings';

export function getDevServerHost() {
  return appJsonStore.getItem(PERSIST_KEY, {})?.devServerHost;
}

const devServerSettingsAtom = atomByMMKV(PERSIST_KEY, {
  /** @sample 192.168.0.1:9090 */
  devServerHost: '',
});

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
