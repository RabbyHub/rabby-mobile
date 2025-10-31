// @ts-expect-error lack type
import type TrezorConnect from '@trezor/connect-mobile';

export type TrezorBridgeInterface = {
  model: string;
  isDeviceConnected: boolean;
  connectDevices: Set<string>;
  init: (typeof TrezorConnect)['init'];
  dispose: () => void;
  getPublicKey: (typeof TrezorConnect)['getPublicKey'];
  ethereumSignTransaction: (typeof TrezorConnect)['ethereumSignTransaction'];
  ethereumSignMessage: (typeof TrezorConnect)['ethereumSignMessage'];
  ethereumSignTypedData: (typeof TrezorConnect)['ethereumSignTypedData'];
};
