import { Image, Platform } from 'react-native';
import { getVersion } from 'react-native-device-info';

// export const INITIAL_OPENAPI_URL = 'https://api.rabby.io';
export const INITIAL_OPENAPI_URL = 'https://app-api.rabby.io';

export const INITIAL_TESTNET_OPENAPI_URL = 'https://api.testnet.rabby.io';

export const INTERNAL_REQUEST_ORIGIN =
  'chrome-extension://acmacodkjbdgmoleebolmdjonilkdbch';

export const INTERNAL_REQUEST_SESSION = {
  name: 'Rabby',
  origin: INTERNAL_REQUEST_ORIGIN,
  icon: Image.resolveAssetSource(require('@/assets/images/rabby-site-logo.png'))
    .uri,
};

export enum CANCEL_TX_TYPE {
  QUICK_CANCEL = 'QUICK_CANCEL',
  ON_CHAIN_CANCEL = 'ON_CHAIN_CANCEL',
}

const fromJs = process.env.APP_VERSION!;
const fromNative = getVersion();
export const APP_VERSIONS = {
  fromJs,
  fromNative,
  forCheckUpgrade: __DEV__ ? fromJs : fromNative,
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

// TODO: add native method to get bundler id
export const APPLICATION_ID =
  Platform.OS == 'android'
    ? 'com.debank.rabbymobile'
    : __DEV__
    ? 'com.debank.rabby-mobile-debug'
    : 'com.debank.rabby-mobile';
