import RNFS from 'react-native-fs';

import { stringUtils } from '@rabby-wallet/base-utils';
import { IS_ANDROID } from '../native/utils';

/**
 * run `./scripts/fns.sh update_webview_assets && yarn link-assets` at project root to update the assets
 *
 * ios ref sample: file:///./../../../assets/custom/vconsole.min.js
 */

export const WEBVIEW_BASEURL = IS_ANDROID
  ? 'file:///android_asset/custom/'
  : stringUtils.ensureSuffix(RNFS.MainBundlePath, '/');
const ASSETS_BASE = IS_ANDROID ? 'file:///android_asset/custom/' : './';

export function refAssetForLocalWebView(p: string) {
  const path = stringUtils.unPrefix(p, '/');
  const rawPath = `${ASSETS_BASE}${path}`;
  const fullPath = `${WEBVIEW_BASEURL}${path}`;

  return {
    quoted: JSON.stringify(rawPath),
    rawPath,
    fullPath,
  };
}

export function isValidUrlForWebView(url: string) {
  // allow any url in dev mode
  if (!__DEV__) return true;

  if (IS_ANDROID) {
    return url.startsWith('file:///android_asset/custom/');
  }

  return url.startsWith('./');
}
