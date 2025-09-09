import { appIsDev } from '@/constant/env';
import type { TrezorBridgeInterface } from '@rabby-wallet/eth-keyring-trezor';
import TrezorConnect from '@trezor/connect-mobile';
import { Linking } from 'react-native';

export default class TrezorBridge implements TrezorBridgeInterface {
  isDeviceConnected = false;
  model = '';
  connectDevices = new Set<string>();
  init: TrezorBridgeInterface['init'] = async config => {
    if (!this.isDeviceConnected) {
      TrezorConnect.init({
        debug: appIsDev,
        manifest: {
          email: 'support@rabby.io',
          appName: 'Rabby Wallet',
          appUrl: 'https://rabby.io/',
        },
        // for local development purposes. for production, leave it undefined to use the default value.
        // connectSrc: appIsDev
        //   ? 'trezorsuitelite://connect'
        //   : 'https://connect.trezor.io/9/',
        connectSrc: 'https://connect.trezor.io/9/',

        deeplinkOpen: async url => {
          console.debug('deeplinkOpen', url);
          Linking.openURL(url);
        },
        deeplinkCallbackUrl: 'rabby://connect-trezor',
        ...config,
      });
      this.isDeviceConnected = true;
    }
  };
  dispose = TrezorConnect.dispose;

  getPublicKey = TrezorConnect.ethereumGetPublicKey;

  ethereumSignTransaction = TrezorConnect.ethereumSignTransaction;

  ethereumSignMessage = TrezorConnect.ethereumSignMessage;

  ethereumSignTypedData = TrezorConnect.ethereumSignTypedData;
}
