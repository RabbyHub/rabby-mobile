if (__DEV__) {
  import("./ReactotronConfig").then(() => console.log("Reactotron Configured"));
}
/**
 * @format
 */
import 'react-native-gesture-handler';
import './global';
import './src/setup-app';

import { enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import App from './src/App';
import '@/utils/i18n';
import { name as appName } from './app.json';

enableScreens();
// must be called synchoronously immediately
AppRegistry.registerComponent(appName, () => App);
