import HardwareBleSdk from '@onekeyfe/hd-ble-sdk';
import { UI_EVENT, UI_REQUEST, UI_RESPONSE } from '@onekeyfe/hd-core';

import type { OneKeyBridgeInterface } from '@rabby-wallet/eth-keyring-onekey';

export default class OneKeyBridge implements OneKeyBridgeInterface {
  init: OneKeyBridgeInterface['init'] = async () => {
    await HardwareBleSdk.init({
      debug: true,
      fetchConfig: true,
    });
    HardwareBleSdk.on(UI_EVENT, e => {
      switch (e.type) {
        case UI_REQUEST.REQUEST_PIN:
          HardwareBleSdk.uiResponse({
            type: UI_RESPONSE.RECEIVE_PIN,
            payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
          });
          break;
        case UI_REQUEST.REQUEST_PASSPHRASE:
          HardwareBleSdk.uiResponse({
            type: UI_RESPONSE.RECEIVE_PASSPHRASE,
            payload: {
              value: '',
              passphraseOnDevice: true,
              save: true,
            },
          });
          break;
        default:
        // NOTHING
      }
    });
  };

  evmSignTransaction = HardwareBleSdk.evmSignTransaction;

  evmSignMessage = HardwareBleSdk.evmSignMessage;

  evmSignTypedData = HardwareBleSdk.evmSignTypedData;

  searchDevices = HardwareBleSdk.searchDevices;

  getPassphraseState = HardwareBleSdk.getPassphraseState;

  evmGetPublicKey = HardwareBleSdk.evmGetPublicKey;

  getFeatures = HardwareBleSdk.getFeatures;
}
