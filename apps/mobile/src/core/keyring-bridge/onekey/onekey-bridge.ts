import { eventBus, EVENTS } from '@/utils/events';
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
          eventBus.emit(EVENTS.ONEKEY.REQUEST_PIN);
          break;
        case UI_REQUEST.REQUEST_PASSPHRASE:
          eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE);
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

  receivePin = ({ pin, switchOnDevice }) => {
    HardwareBleSdk.uiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: switchOnDevice ? '@@ONEKEY_INPUT_PIN_IN_DEVICE' : pin,
    });
  };

  receivePassphrase = ({ passphrase, switchOnDevice }) => {
    HardwareBleSdk.uiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: passphrase,
        passphraseOnDevice: switchOnDevice,
        save: true,
      },
    });
  };
}
