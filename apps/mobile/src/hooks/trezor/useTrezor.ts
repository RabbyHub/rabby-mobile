import { Linking } from 'react-native';
import TrezorConnect from '@trezor/connect-mobile';
import { urlUtils } from '@rabby-wallet/base-utils';

export const TREZOR_CALLBACK_PATH_NAME = 'connect-trezor';

export const startSubscribeTrezorConnectOnUrl = () => {
  const subscription = Linking.addEventListener('url', event => {
    // only forward Trezor return links, other deeplinks must not settle pending Trezor requests
    const pathname = urlUtils.safeParseURL(event.url)?.pathname;
    if (!pathname?.endsWith(`/${TREZOR_CALLBACK_PATH_NAME}`)) {
      return;
    }
    TrezorConnect.handleDeeplink(event.url);
  });

  return subscription;
};
