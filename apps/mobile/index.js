/**
 * @format
 */
import 'react-native-gesture-handler';
import './global';
import './src/setup-app';
if (__DEV__) {
  import('./ReactotronConfig').then(() => console.log('Reactotron Configured'));
}

import { enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import App from './src/App';
import '@/utils/i18n';
import { name as appName } from './app.json';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

enableScreens();
// must be called synchoronously immediately
AppRegistry.registerComponent(appName, () => App);

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});

import { getTimeSinceStartup } from 'react-native-startup-time';

// when you app is ready:
getTimeSinceStartup().then(time => {
  console.log(`当前启动时间: ${time} ms`);
});
