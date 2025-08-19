// export const ANDROID_DESKTOP_MODE_UA =
//   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

import { Dimensions, Platform } from 'react-native';

export const DESKTOP_MODE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

export const USER_AGENT = {
  IOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ANDROID:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
};

export const IOS_APP_STORE_URL_PREFIXES = [
  'itms-apps://',
  'itms-appss://',
  'https://itunes.apple.com',
  'https://apps.apple.com',
];
export const ANDROID_APP_STORE_URL_PREFIXES = [
  'market://',
  'https://play.google.com/store',
];

export const APP_STORE_URL_PREFIXES = [
  ...IOS_APP_STORE_URL_PREFIXES,
  ...ANDROID_APP_STORE_URL_PREFIXES,
];

export const BOTTOM_SHEET_EXTRA = 36;
export const WEBVIEW_HEIGHT =
  Dimensions.get('screen').height - 124 - BOTTOM_SHEET_EXTRA;
export const GROW_WEBVIEW_THRESHOLD = 10;
export const SHRINK_WEBVIEW_THRESHOLD = 10;
export const EXTRA_WEBVIEW_HEIGHT = Platform.OS === 'ios' ? 68 : 44;
export const EXTRA_MIN_MARGIN = 16;
