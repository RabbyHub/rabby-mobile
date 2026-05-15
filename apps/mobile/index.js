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

import { initSentry } from './src/core/sentry';
// Init Sentry before polyfills as it patches global Promise
// @see https://docs.sentry.io/platforms/react-native/integrations/unhandled-rejections/#auto-patching-default-behavior
if (!__DEV__) {
  initSentry();
}

import './src/utils/logging/install';
import './global';
import './src/setup-app';
import { ENABLE_REACTOTRON } from './src/core/utils/reactotron-plugins/featureFlag';

if (process.env.WITH_ROZENITE === 'true') {
  const {
    withOnBootNetworkActivityRecording,
  } = require('@rozenite/network-activity-plugin');
  withOnBootNetworkActivityRecording();
}

if (__DEV__ && ENABLE_REACTOTRON) {
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
