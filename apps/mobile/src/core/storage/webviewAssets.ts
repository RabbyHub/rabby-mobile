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
  : stringUtils.unSuffix(RNFS.MainBundlePath, '/');
const ASSETS_BASE = IS_ANDROID ? 'file:///android_asset/custom/' : './';

export function refAssetForTradeView(p: string) {
  const path = stringUtils.unPrefix(p, '/');
  const rawPath = `${ASSETS_BASE}${path}`;
  return {
    quoted: JSON.stringify(rawPath),
    rawPath,
  };
}
