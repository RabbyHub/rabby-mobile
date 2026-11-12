import type TrezorConnect from '@trezor/connect-mobile';

export type TrezorBridgeInterface = {
  model: string;
  isDeviceConnected: boolean;
  connectDevices: Set<string>;
  init: (
    config?: Partial<Parameters<(typeof TrezorConnect)['init']>[0]>,
  ) => ReturnType<(typeof TrezorConnect)['init']> | void;
  dispose: () => void;
  getPublicKey: (typeof TrezorConnect)['getPublicKey'];
  ethereumSignTransaction: (typeof TrezorConnect)['ethereumSignTransaction'];
  ethereumSignMessage: (typeof TrezorConnect)['ethereumSignMessage'];
  ethereumSignTypedData: (typeof TrezorConnect)['ethereumSignTypedData'];
};
