import { eventBus, EVENTS } from '@/utils/events';
import HardwareBleSdk from '@onekeyfe/hd-ble-sdk';
import { UI_EVENT, UI_REQUEST, UI_RESPONSE } from '@onekeyfe/hd-core';

import type { OneKeyBridgeInterface } from '@rabby-wallet/eth-keyring-onekey';

export default class OneKeyBridge implements OneKeyBridgeInterface {
  init: OneKeyBridgeInterface['init'] = async () => {
    await HardwareBleSdk.init({
      debug: false,
      fetchConfig: true,
    });
    HardwareBleSdk.on(UI_EVENT, e => {
      switch (e.type) {
        case UI_REQUEST.REQUEST_PIN:
          eventBus.emit(EVENTS.ONEKEY.REQUEST_PIN, e);
          break;
        case UI_REQUEST.REQUEST_PASSPHRASE:
          eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, e);
          break;
        case UI_REQUEST.CLOSE_UI_WINDOW:
          eventBus.emit(EVENTS.ONEKEY.CLOSE_UI_WINDOW, e);
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

  receivePin = data => {
    HardwareBleSdk.uiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: data.switchOnDevice ? '@@ONEKEY_INPUT_PIN_IN_DEVICE' : data.pin,
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

  cancel = HardwareBleSdk.cancel;

  dispose = HardwareBleSdk.dispose;
}
