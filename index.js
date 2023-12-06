/**
 * @format
 */
// import 'react-native-gesture-handler';
import './global';
import '@walletconnect/react-native-compat';

import { enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

enableScreens();
AppRegistry.registerComponent(appName, () => App);
