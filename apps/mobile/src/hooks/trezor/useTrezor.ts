import { Linking } from 'react-native';
import TrezorConnect, {
  BLOCKCHAIN_EVENT,
  DEVICE_EVENT,
  TRANSPORT_EVENT,
} from '@trezor/connect-mobile';
import { toast } from '@/components2024/Toast';

const trezorOnEvent = () => {
  TrezorConnect.on(DEVICE_EVENT, event => {
    toast.info(`TrezorConnect event: ${JSON.stringify(event)}`);
    console.debug('TrezorConnect event', event);
  });

  TrezorConnect.on(BLOCKCHAIN_EVENT, event => {
    toast.info(`TrezorConnect BLOCKCHAIN_EVENT: ${JSON.stringify(event)}`);
    console.debug('TrezorConnect BLOCKCHAIN_EVENT', event);
  });

  TrezorConnect.on(TRANSPORT_EVENT, event => {
    toast.info(`TrezorConnect TRANSPORT_EVENT: ${JSON.stringify(event)}`);
    console.debug('TrezorConnect TRANSPORT_EVENT', event);
  });
};

export const startSubscribeTrezorConnectOnUrl = () => {
  trezorOnEvent();

  const subscription = Linking.addEventListener('url', event => {
    TrezorConnect.handleDeeplink(event.url);
  });

  return subscription;
};
