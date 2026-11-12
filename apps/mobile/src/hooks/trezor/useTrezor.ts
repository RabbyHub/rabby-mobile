import { Linking } from 'react-native';
import TrezorConnect from '@trezor/connect-mobile';

export const startSubscribeTrezorConnectOnUrl = () => {
  const subscription = Linking.addEventListener('url', event => {
    TrezorConnect.handleDeeplink(event.url);
  });

  return subscription;
};
