import { NativeModules } from 'react-native';
import Reactotron from 'reactotron-react-native';
import { REACTOTRON_HOSTNAME as REACTOTRON_HOSTNAME_ } from '@env';

// import { AsyncStorage } from '@react-native-async-storage/async-storage';

function setupConnection() {
  let scriptHostname = '';
  try {
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
  } catch (error) {
    console.error('[ReactotronConfig] Failed to parse scriptURL:', error);
  }
  console.debug(
    '[ReactotronConfig] REACTOTRON_HOSTNAME_ %s; scriptHostname %s',
    REACTOTRON_HOSTNAME_,
    scriptHostname,
  );

  const finalScriptHostname = REACTOTRON_HOSTNAME_ || scriptHostname;

  Reactotron
    // .setAsyncStorageHandler(AsyncStorage)
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

if (__DEV__) {
  setTimeout(() => {
    setupConnection();
  }, 100);
}
