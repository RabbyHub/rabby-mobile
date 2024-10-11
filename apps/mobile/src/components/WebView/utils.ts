import { urlUtils } from '@rabby-wallet/base-utils';
import { ShouldStartLoadRequestEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent';

import {
  allowLinkOpen,
  getAlertMessage,
  protocolAllowList,
  trustedProtocolToDeeplink,
} from '@/constant/dappView';
import { Alert } from 'react-native';

/**
 *  Function that allows custom handling of any web view requests.
 *  Return `true` to continue loading the request and `false` to stop loading.
 */
export function checkShouldStartLoadingWithRequestForDappWebView(
  evt: Pick<ShouldStartLoadRequestEvent, 'url'>,
): boolean /* should allow */ {
  const url = evt.url;
  const { protocol = '' } = urlUtils.safeParseURL(url) || {};
  // Continue request loading it the protocol is whitelisted
  if (protocolAllowList.includes(protocol)) return true;

  // If it is a trusted deeplink protocol, do not show the
  // warning alert. Allow the OS to deeplink the URL
  // and stop the webview from loading it.
  if (trustedProtocolToDeeplink.includes(protocol)) {
    allowLinkOpen(url);
    return false;
  }

  const alertResult = getAlertMessage(protocol);
  if (alertResult.needAlert) {
    // Pop up an alert dialog box to prompt the user for permission
    // to execute the request
    Alert.alert('Warning', alertResult.message, [
      {
        text: 'Ignore',
        onPress: () => null,
        style: 'cancel',
      },
      {
        text: 'Allow',
        onPress: () => allowLinkOpen(url),
        style: 'default',
      },
    ]);
  }

  return alertResult.allowOpenLink;
}

const allowedExternalDomains = [
  {
    protocol: 'https:',
    domain: 'debank.com',
  },
  {
    protocol: 'https:',
    domain: 'rabby.io',
  },
] as const;
/**
 * @description used to open some known, confirmed sites in the built-in webview
 * @param evt
 */
export function checkShouldStartLoadingWithRequestForTrustedContent(
  evt: Pick<ShouldStartLoadRequestEvent, 'url'>,
): boolean /* should allow */ {
  const url = evt.url;
  const { protocol = '', hostname } = urlUtils.safeParseURL(url) || {};

  // allow open trusted domains with https://
  if (
    allowedExternalDomains.some(
      allowed => allowed.protocol === protocol && allowed.domain === hostname,
    )
  ) {
    allowLinkOpen(url);
    return false;
  }

  const alertResult = getAlertMessage(protocol);
  if (alertResult.needAlert) {
    // Pop up an alert dialog box to prompt the user for permission
    // to execute the request
    Alert.alert('Warning', alertResult.message, [
      {
        text: 'Ignore',
        onPress: () => null,
        style: 'cancel',
      },
      {
        text: 'Allow',
        onPress: () => allowLinkOpen(url),
        style: 'default',
      },
    ]);
  }

  return alertResult.allowOpenLink;
}
