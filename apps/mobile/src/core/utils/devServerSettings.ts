import { NativeModules } from 'react-native';
import Reactotron, { ReactotronReactNative } from 'reactotron-react-native';
import { useAtom } from 'jotai';

import { DEV_SERVER_HOSTNAME as DEV_SERVER_HOSTNAME_ } from '@env';
import { appJsonStore, atomByMMKV } from '../storage/mmkv';
import { useCallback } from 'react';
import { isNonPublicProductionEnv } from '@/constant/env';

const PERSIST_KEY = '@devServerSettings';

export function getDevServerHost() {
  return appJsonStore.getItem(PERSIST_KEY, {})?.devServerHost;
}

const instanceRef = { current: null as null | ReactotronReactNative };
export function setupReactotronConnection() {
  let persistedHostname = '';
  let scriptHostname = '';
  try {
    if (__DEV__) {
      console.debug(
        '[ReactotronConfig] NativeModules.SourceCode?.scriptURL %s',
        NativeModules.SourceCode?.scriptURL,
      );
      scriptHostname = new URL(NativeModules.SourceCode?.scriptURL).hostname;

      // why: for usb connection, the scriptHostname is often 'localhost', then developer need to set DEV_SERVER_HOSTNAME on .env[.local] file
      if (scriptHostname === 'localhost') {
        console.debug(
          '[ReactotronConfig] scriptHostname localhost, set to empty string',
        );
        scriptHostname = '';
      }
    }
  } catch (error) {
    console.error('[ReactotronConfig] Failed to parse scriptURL:', error);
  }

  if (isNonPublicProductionEnv) {
    persistedHostname = getDevServerHost();
  }

  console.debug(
    '[ReactotronConfig] DEV_SERVER_HOSTNAME_ %s; scriptHostname %s; persistedHostname: %s',
    DEV_SERVER_HOSTNAME_,
    scriptHostname,
    persistedHostname,
  );

  const finalScriptHostname =
    DEV_SERVER_HOSTNAME_ || persistedHostname || scriptHostname;

  if (instanceRef.current) {
    instanceRef.current.close();
    instanceRef.current = null;
  }

  if (finalScriptHostname) {
    instanceRef.current = Reactotron
      // controls connection & communication settings
      .configure({
        name: 'Rabby Mobile',
        host: finalScriptHostname,
      })
      // add all built-in react native plugins
      .useReactNative({
        asyncStorage: false, // there are more options to the async storage.
      })
      .connect(); // let's connect!
  }

  return instanceRef.current;
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
        if (devServerHost) {
          setTimeout(() => {
            setupReactotronConnection();
          }, 2000);
        }
        return { ...prev, devServerHost };
      });
    },
    [setDevServerSettings],
  );

  return { devServerSettings, setDevServerHost };
}
