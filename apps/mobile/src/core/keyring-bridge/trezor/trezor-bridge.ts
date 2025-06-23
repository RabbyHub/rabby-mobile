import { appIsDev } from '@/constant/env';
import type { TrezorBridgeInterface } from '@rabby-wallet/eth-keyring-trezor';
import TrezorConnect from '@trezor/connect-mobile';
import { Linking } from 'react-native';

export default class TrezorBridge implements TrezorBridgeInterface {
  isDeviceConnected = false;
  // event = eventBus;
  model = '';
  connectDevices = new Set<string>();
  init: TrezorBridgeInterface['init'] = async config => {
    // TrezorConnect.on('DEVICE_EVENT', (event: any) => {
    //   if (event && event.payload && event.payload.features) {
    //     this.model = event.payload.features.model;
    //   }
    //   const currentDeviceId = event.payload?.id;
    //   if (event.type === 'device-connect') {
    //     this.connectDevices.add(currentDeviceId);

    //     // this.event.emit('cleanUp', true);
    //   }
    //   if (event.type === 'device-disconnect') {
    //     this.connectDevices.delete(currentDeviceId);
    //     // this.event.emit('cleanUp', true);
    //   }
    //   console.debug('trezor DEVICE_EVENT', event.type, event);
    // });

    if (!this.isDeviceConnected) {
      TrezorConnect.init({
        debug: appIsDev,
        manifest: {
          email: 'developer@xyz.com',
          appName: 'Trezor Connect Example',
          appUrl: 'https://your.application.com',
        },
        // for local development purposes. for production, leave it undefined to use the default value.
        // connectSrc: 'https://connect.trezor.io/9/', //isEmulator ? 'trezorsuitelite://connect' : undefined,
        connectSrc: appIsDev
          ? 'trezorsuitelite://connect'
          : 'https://connect.trezor.io/9/',

        deeplinkOpen: url => {
          // eslint-disable-next-line no-console
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
