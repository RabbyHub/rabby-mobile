import { NativeModules } from 'react-native';
import Reactotron, { ReactotronReactNative } from 'reactotron-react-native';
import { DEV_SERVER_HOSTNAME as DEV_SERVER_HOSTNAME_ } from '@env';
import { APP_VERSIONS, isNonPublicProductionEnv } from '@/constant';
import { getDevServerHost } from '@/core/utils/devServerSettings';
import mmkvPlugin from '@/core/utils/reactotron-plugins/react-native-mmkv';
import opSQLitePlugin from '@/core/utils/reactotron-plugins/op-sqlite';
import '@/core/utils/reactotron-plugins/_setup';
import {
  reactotronEvents,
  waitTronReady,
} from '@/core/utils/reactotron-plugins/_utils';
import { setupCustomCommands } from '@/core/utils/reactotron-plugins/_setup';

export async function setupReactotronConnection() {
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

  let client: null | ReactotronReactNative = null;
  const waitTronP = waitTronReady();
  if (finalScriptHostname) {
    Reactotron.clear();
    client = Reactotron.use(
      mmkvPlugin<ReactotronReactNative>({
        storage: require('@/core/storage/mmkv').appMMKVForDebug,
      }),
    )
      .use(opSQLitePlugin<ReactotronReactNative>())
      // controls connection & communication settings
      .configure({
        getClientId: async () => `RabbyMobile${APP_VERSIONS.fromJs}`,
        name: 'Rabby Mobile',
        host: finalScriptHostname,
      })
      // add all built-in react native plugins
      .useReactNative({
        asyncStorage: false, // there are more options to the async storage.
      })
      .connect(); // let's connect!

    setupCustomCommands(client);

    reactotronEvents.emit('__REACTOTRON_LOADED__', { client });

    await waitTronP;
  }

  return client;
}

if (__DEV__) {
  setTimeout(() => {
    setupReactotronConnection();
  }, 100);
}
