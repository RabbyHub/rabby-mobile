/**
 * @format
 */
import 'react-native-gesture-handler';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import { enableFreeze, enableScreens } from 'react-native-screens';
// enableFreeze();
enableScreens(true);

import './global';
import './src/setup-app';
if (__DEV__) {
  import('./ReactotronConfig');
}

import { AppRegistry } from 'react-native';
import App from './src/App';
import '@/utils/i18n';
import { name as appName } from './app.json';

import './src/setup-app-before-render';

// must be called synchoronously immediately
AppRegistry.registerComponent(appName, () => App);

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});
