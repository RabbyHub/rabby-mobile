// export const ANDROID_DESKTOP_MODE_UA =
//   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

export const ANDROID_DESKTOP_MODE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';

export const USER_AGENT = {
  IOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  ANDROID:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/53',
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
