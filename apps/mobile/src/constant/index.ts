import { Image, Platform, NativeModules } from 'react-native';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { stringUtils } from '@rabby-wallet/base-utils';

import { CHAINS_ENUM } from './chains';
import { BUILD_CHANNEL } from './env';

export const INITIAL_OPENAPI_URL = 'https://app-api.rabby.io';

export const INITIAL_TESTNET_OPENAPI_URL = 'https://api.testnet.rabby.io';

export const INTERNAL_REQUEST_ORIGIN =
  'chrome-extension://acmacodkjbdgmoleebolmdjonilkdbch';

export const INTERNAL_REQUEST_SESSION = {
  name: 'Rabby',
  origin: INTERNAL_REQUEST_ORIGIN,
  icon: Image.resolveAssetSource(
    require('@/assets/images/rabby-chain-logo.png'),
  ).uri,
};

export enum CANCEL_TX_TYPE {
  QUICK_CANCEL = 'QUICK_CANCEL',
  ON_CHAIN_CANCEL = 'ON_CHAIN_CANCEL',
  REMOVE_LOCAL_PENDING_TX = 'REMOVE_LOCAL_PENDING_TX',
}

const fromJs = process.env.APP_VERSION!;
const fromNative = getVersion();
const buildNumber = getBuildNumber();
// const fullVersionNumber = `${fromNative}.${buildNumber}`;
export const APP_VERSIONS = {
  fromJs,
  fromNative,
  forSentry: fromNative,
  forCheckUpgrade: __DEV__ ? fromJs : fromNative,

  buildNumber,

  forFeedback: `${fromNative} (${buildNumber})`,
};

const UA_NAME = 'RabbyMobile' as const;
const UA_VERSION = APP_VERSIONS.fromNative;
export const APP_UA_PARIALS = {
  UA_NAME,
  UA_VERSION,
  UA_FULL_NAME: Platform.select({
    android:
      `${UA_NAME}/${UA_VERSION} ${UA_NAME}Android/${UA_VERSION}` as const,
    ios: `${UA_NAME}/${UA_VERSION} ${UA_NAME}IOS/${UA_VERSION}` as const,
  })!,
};

export const APP_URLS = {
  PRIVACY_POLICY: 'https://rabby.io/docs/privacy',
  TWITTER: 'https://twitter.com/rabby_io',

  DOWNLOAD_PAGE: 'https://rabby.io/?platform=mobile',

  STORE_URL: Platform.select({
    android:
      'https://play.google.com/store/apps/details?id=com.debank.rabbymobile',
    ios: 'https://apps.apple.com/us/app/rabby-wallet-crypto-evm/id6474381673',
  })!,

  RATE_URL:
    Platform.select({
      // android: 'market://details?id=com.debank.rabbymobile',
      android:
        'https://play.google.com/store/apps/details?id=com.debank.rabbymobile',
      ios: 'itms-apps://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?type=Purple+Software&id=6474381673',
    }) || '',
};

type AndroidIdSuffx = '' | '.debug' | '.regression';
export const APPLICATION_ID = NativeModules.RNVersionCheck.packageName;
const realAndroidPackageName = NativeModules.RNVersionCheck.packageName;
const androidPackageName = (
  !realAndroidPackageName
    ? 'com.debank.rabbymobile'
    : stringUtils.unSuffix(
        stringUtils.unSuffix(realAndroidPackageName, '.debug'),
        '.regression',
      )
) as `com.debank.rabbymobile${AndroidIdSuffx}`;
export const APP_IDS = {
  forScreenshot: APPLICATION_ID.replace(/[\.\-]/g, '_'),
};

type IosIdSuffix = '' | '-debug' | '-regression';

export const PROD_APPLICATION_ID:
  | typeof androidPackageName
  | `com.debank.rabby-mobile${IosIdSuffix}` =
  Platform.OS == 'android'
    ? androidPackageName
    : __DEV__
    ? ('com.debank.rabby-mobile-debug' as const)
    : ('com.debank.rabby-mobile' as const);

const isSelfhostRegPkg =
  BUILD_CHANNEL === 'selfhost-reg' && APPLICATION_ID !== PROD_APPLICATION_ID;
export const isNonPublicProductionEnv = isSelfhostRegPkg || __DEV__;
export const NEED_DEVSETTINGBLOCKS = isSelfhostRegPkg || __DEV__;

const FirebaseWebClientIds = {
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
    android: FirebaseWebClientIds[realAndroidPackageName],
    ios: FirebaseWebClientIds[APPLICATION_ID],
  }) || FirebaseWebClientIds[realAndroidPackageName];

export const APP_TEST_PWD = __DEV__ ? '11111111' : '';

export const APP_FEATURE_SWITCH = {
  customizePassword: true,
  get biometricsAuth() {
    return !!this.customizePassword;
  },
};

export const SELF_HOST_SAFE_NETWORKS = [
  '1',
  '56',
  '10',
  '42161',
  '137',
  '8453',
];
