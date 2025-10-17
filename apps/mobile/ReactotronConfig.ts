import { NativeModules } from 'react-native';
import Reactotron, { ReactotronReactNative } from 'reactotron-react-native';
import { DEV_SERVER_HOSTNAME as DEV_SERVER_HOSTNAME_ } from '@env';
import { isNonPublicProductionEnv } from '@/constant/env';
import { getDevServerHost } from '@/core/utils/devServerSettings';

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

if (__DEV__) {
  setTimeout(() => {
    setupReactotronConnection();
  }, 100);
}
