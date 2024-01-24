import { NativeModules } from 'react-native';
import Reactotron from "reactotron-react-native";
import { AsyncStorage } from "@react-native-async-storage/async-storage";

let scriptHostname;
if (__DEV__) {
    const scriptURL = NativeModules.SourceCode.scriptURL;
    scriptHostname = scriptURL.split('://')[1].split(':')[0];
    console.debug('[ReactotronConfig] scriptHostname %s', scriptHostname)
}

Reactotron.setAsyncStorageHandler(AsyncStorage)
  // controls connection & communication settings
  .configure({
    name: "Rabby Mobile",
    host: scriptHostname,
  })
  // add all built-in react native plugins
  .useReactNative({
    asyncStorage: false, // there are more options to the async storage.
  })
  .connect(); // let's connect!
