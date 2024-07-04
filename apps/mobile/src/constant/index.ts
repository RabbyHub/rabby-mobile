import { Image, Platform, NativeModules } from 'react-native';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { stringUtils } from '@rabby-wallet/base-utils';

import { CHAINS_ENUM } from './chains';

// export const INITIAL_OPENAPI_URL = 'https://api.rabby.io';
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
}

const fromJs = process.env.APP_VERSION!;
const fromNative = getVersion();
const buildNumber = getBuildNumber();
const fullVersionNumber = `${fromNative}.${buildNumber}`;
export const APP_VERSIONS = {
  fromJs,
  fromNative,
  forSentry: fullVersionNumber,
  forCheckUpgrade: __DEV__ ? fromJs : fromNative,
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
};

const androidPackageName = !NativeModules.RNVersionCheck.packageName
  ? 'com.debank.rabbymobile'
  : stringUtils.unSuffix(
      stringUtils.unSuffix(NativeModules.RNVersionCheck.packageName, '.debug'),
      '.reg',
    );

export const APPLICATION_ID =
  Platform.OS == 'android'
    ? androidPackageName
    : __DEV__
    ? 'com.debank.rabby-mobile-debug'
    : 'com.debank.rabby-mobile';

export const APP_TEST_PWD = __DEV__ ? '11111111' : '';

export const APP_FEATURE_SWITCH = {
  customizePassword: false,
  get biometricsAuth() {
    return !!this.customizePassword;
  },
};

export const GNOSIS_SUPPORT_CHAINS = [
  CHAINS_ENUM.ETH,
  CHAINS_ENUM.BSC,
  CHAINS_ENUM.POLYGON,
  CHAINS_ENUM.GNOSIS,
  CHAINS_ENUM.AVAX,
  CHAINS_ENUM.OP,
  CHAINS_ENUM.ARBITRUM,
  CHAINS_ENUM.AURORA,
  CHAINS_ENUM.BASE,
  CHAINS_ENUM.CELO,
  CHAINS_ENUM.PZE,
  CHAINS_ENUM.ERA,
];
