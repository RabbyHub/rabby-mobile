import { NativeModules, Platform } from 'react-native';
import { stringUtils } from '@rabby-wallet/base-utils';

import { BUILD_CHANNEL } from './env';

type AndroidIdSuffix = '' | '.debug' | '.regression';
type IosIdSuffix = '' | '-debug' | '-regression';

export const APPLICATION_ID = NativeModules.RNVersionCheck.packageName;

const realAndroidPackageName = NativeModules.RNVersionCheck.packageName;
const androidPackageName = (
  !realAndroidPackageName
    ? 'com.debank.rabbymobile'
    : stringUtils.unSuffix(
        stringUtils.unSuffix(realAndroidPackageName, '.debug'),
        '.regression',
      )
) as `com.debank.rabbymobile${AndroidIdSuffix}`;

export const APP_IDS = {
  forScreenshot: APPLICATION_ID.replace(/[\.\-]/g, '_'),
};

export const PROD_APPLICATION_ID:
  | typeof androidPackageName
  | `com.debank.rabby-mobile${IosIdSuffix}` =
  Platform.OS === 'android'
    ? androidPackageName
    : __DEV__
    ? ('com.debank.rabby-mobile-debug' as const)
    : ('com.debank.rabby-mobile' as const);

const isSelfhostRegPkg =
  BUILD_CHANNEL === 'selfhost-reg' && APPLICATION_ID !== PROD_APPLICATION_ID;

export const isNonPublicProductionEnv = isSelfhostRegPkg || __DEV__;
export const NEED_DEVSETTINGBLOCKS = isSelfhostRegPkg || __DEV__;

const firebaseWebClientIds = {
  'com.debank.rabbymobile.debug':
    '809331497367-vv5g8gs5v7187a349pon5ggnsrgr7uuj.apps.googleusercontent.com',
  'com.debank.rabbymobile.regression':
    '809331497367-vv5g8gs5v7187a349pon5ggnsrgr7uuj.apps.googleusercontent.com',
  'com.debank.rabbymobile':
    '809331497367-vv5g8gs5v7187a349pon5ggnsrgr7uuj.apps.googleusercontent.com',

  'com.debank.rabby-mobile':
    '809331497367-85vtc15egvte1r5nc30dnno4l1ofbeqg.apps.googleusercontent.com',
  'com.debank.rabby-mobile-debug':
    '809331497367-vip7ti5jnh1umlp99d5r42mqqt9f0vuv.apps.googleusercontent.com',
} as const;

export const FIREBASE_WEBCLIENT_ID =
  Platform.select({
    android: firebaseWebClientIds[realAndroidPackageName],
    ios: firebaseWebClientIds[APPLICATION_ID],
  }) || firebaseWebClientIds[realAndroidPackageName];
