import { NativeModules } from 'react-native';
import Reactotron, { ReactotronReactNative } from 'reactotron-react-native';
import { useAtom } from 'jotai';

import { REACTOTRON_HOSTNAME as REACTOTRON_HOSTNAME_ } from '@env';
import { appJsonStore, atomByMMKV } from '../storage/mmkv';
import { useCallback } from 'react';
import { isNonPublicProductionEnv } from '@/constant/env';

const PERSIST_KEY = '@expReactotronSettings';

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

      // why: for usb connection, the scriptHostname is often 'localhost', then developer need to set REACTOTRON_HOSTNAME on .env[.local] file
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
    persistedHostname = appJsonStore.getItem(PERSIST_KEY, {})?.metroServer;
  }

  console.debug(
    '[ReactotronConfig] REACTOTRON_HOSTNAME_ %s; scriptHostname %s; persistedHostname: %s',
    REACTOTRON_HOSTNAME_,
    scriptHostname,
    persistedHostname,
  );

  const finalScriptHostname =
    REACTOTRON_HOSTNAME_ || persistedHostname || scriptHostname;

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

const reactotronSettingsAtom = atomByMMKV(PERSIST_KEY, {
  /** @sample 192.168.0.1:9090 */
  metroServer: '',
});

export function useReactotronSettings() {
  const [reactotronSettings, setReactotronSettings] = useAtom(
    reactotronSettingsAtom,
  );

  const setReactotronServer = useCallback(
    (metroServer: string) => {
      setReactotronSettings(prev => {
        if (metroServer) {
          setTimeout(() => {
            setupReactotronConnection();
          }, 2000);
        }
        return { ...prev, metroServer };
      });
    },
    [setReactotronSettings],
  );

  return { reactotronSettings, setReactotronServer };
}
