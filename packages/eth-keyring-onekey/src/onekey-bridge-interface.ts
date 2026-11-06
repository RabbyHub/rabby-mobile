import type { CoreApi, UiResponseCorrelation } from '@onekeyfe/hd-core';

export type ReceivePinParams = (
  | {
      pin: string;
      switchOnDevice: false;
    }
  | {
      switchOnDevice: true;
    }
) & { responseCorrelation?: UiResponseCorrelation };

export type ReceivePassphraseParams = {
  passphrase: string;
  switchOnDevice: boolean;
  responseCorrelation?: UiResponseCorrelation;
};

export type OneKeyBridgeInterface = {
  init: () => Promise<void>;
  evmSignTransaction: CoreApi['evmSignTransaction'];
  evmSignMessage: CoreApi['evmSignMessage'];
  evmSignTypedData: CoreApi['evmSignTypedData'];
  searchDevices: CoreApi['searchDevices'];
  getPassphraseState: CoreApi['getPassphraseState'];
  evmGetPublicKey: CoreApi['evmGetPublicKey'];
  getDeviceState: CoreApi['getDeviceState'];
  receivePin: (params: ReceivePinParams) => void;
  receivePassphrase: (params: ReceivePassphraseParams) => void;
  cancel: CoreApi['cancel'];
  dispose: CoreApi['dispose'];
};
