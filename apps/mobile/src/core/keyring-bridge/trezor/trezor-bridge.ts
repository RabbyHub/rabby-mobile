import { UL_HOSTNAME, UL_PATH_PREFIX } from '@/constant/universalLink';
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
        manifest: {
          email: 'support@rabby.io',
          appName: 'Rabby Wallet',
          appUrl: 'https://rabby.io/',
        },
        connectSrc: 'https://connect.trezor.io/10/',

        deeplinkOpen: async url => {
          console.debug('deeplinkOpen', url);
          Linking.openURL(url);
        },
        deeplinkCallbackUrl: `https://${UL_HOSTNAME}${UL_PATH_PREFIX}connect-trezor`, //'rabby://connect-trezor',
        ...config,
      });
      this.isDeviceConnected = true;
    }
  };
  dispose = () => TrezorConnect.dispose();

  getPublicKey = TrezorConnect.ethereumGetPublicKey;

  ethereumSignTransaction = TrezorConnect.ethereumSignTransaction;

  ethereumSignMessage = TrezorConnect.ethereumSignMessage;

  ethereumSignTypedData = TrezorConnect.ethereumSignTypedData;
}
