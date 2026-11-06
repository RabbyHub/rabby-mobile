import type { CoreApi } from '@onekeyfe/hd-core';

export type ReceivePinParams =
  | {
      pin: string;
      switchOnDevice: false;
    }
  | {
      switchOnDevice: true;
    };

export type ReceivePassphraseParams = {
  passphrase: string;
  switchOnDevice: boolean;
};

export type OneKeyBridgeInterface = {
  init: () => Promise<void>;
  evmSignTransaction: CoreApi['evmSignTransaction'];
  evmSignMessage: CoreApi['evmSignMessage'];
  evmSignTypedData: CoreApi['evmSignTypedData'];
  searchDevices: CoreApi['searchDevices'];
  getPassphraseState: CoreApi['getPassphraseState'];
  evmGetPublicKey: CoreApi['evmGetPublicKey'];
  getFeatures: CoreApi['getFeatures'];
  receivePin: (params: ReceivePinParams) => void;
  receivePassphrase: (params: ReceivePassphraseParams) => void;
  cancel: CoreApi['cancel'];
  dispose: CoreApi['dispose'];
};
