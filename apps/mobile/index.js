/**
 * @format
 */
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import './global';
import './src/setup-app';
if (__DEV__) {
  import('./ReactotronConfig');
}

import { enableFreeze, enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import App from './src/App';
import '@/utils/i18n';
import { name as appName } from './app.json';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

enableScreens();
// enableFreeze();
// must be called synchoronously immediately
AppRegistry.registerComponent(appName, () => App);

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});
