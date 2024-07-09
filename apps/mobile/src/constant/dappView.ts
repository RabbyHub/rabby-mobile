import { Linking } from 'react-native';
import checkForPhishing from 'eth-phishing-detect';
import { urlUtils } from '@rabby-wallet/base-utils';

/**
 *
 * List of all protocols that our webview load unconditionally
 */
export const protocolAllowList = ['about:', 'http:', 'https:'];

/**
 *
 * List of all trusted protocols for OS Linker to handle
 */
export const trustedProtocolToDeeplink = [
  'wc:',
  'metamask:',
  'ethereum:',
  'dapp:',
];

/**
 * Returns translated warning message for the
 * warning dialog box the user sees when the to be loaded
 * website tries to automatically start an external
 * service
 *
 * @param protocol - String containing the url protocol
 * @returns - String corresponding to the warning message
 */
export const getAlertMessage = (protocol: string) => {
  switch (protocol) {
    case 'tel:':
      return 'This website has been blocked from automatically making a phone call';
    case 'mailto:':
      return 'This website has been blocked from automatically composing an email.';
    default:
      return 'This website has been blocked from automatically opening an external application';
  }
};

/**
 * @description detect if the url is a phishing url
 *
 */
export function detectPhishingUrl(url: string) {
  const urlInfo = urlUtils.safeParseURL(url?.toLowerCase() || '');
  return {
    isPhishing: !!urlInfo?.hostname && checkForPhishing(urlInfo?.hostname),
    protocol: urlInfo?.protocol || '',
    hostname: urlInfo?.hostname || '',
    urlInfo,
  };
}

/**
 * Promps the Operating System for its ability
 * to open an URI outside the Webview
 * Executes it when a positive response is received.
 *
 * @param url - String containing url
 * @returns Promise<any>
 */
export const allowLinkOpen = (url: string) =>
  Linking.canOpenURL(url)
    .then(supported => {
      if (supported) {
        return Linking.openURL(url);
      }
      console.warn(`Can't open url: ${url}`);
      return null;
    })
    .catch(e => {
      console.warn(`Error opening URL: ${e}`);
    });
