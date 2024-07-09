import { Linking } from 'react-native';
import { urlUtils } from '@rabby-wallet/base-utils';

/**
 *
 * List of all protocols that our webview load unconditionally
 */
export const protocolAllowList = ['about:', 'http:', 'https:'];

export function isOrHasWithAllowedProtocol(input?: string) {
  if (!input) return false;
  if (protocolAllowList.includes(input)) return true;

  const { protocol } = urlUtils.safeParseURL(input) || {};
  return !!protocol && protocolAllowList.includes(protocol);
}

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
