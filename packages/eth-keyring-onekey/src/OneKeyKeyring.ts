import EthOneKeyKeyring from './eth-onekey-keyring';
import OneKeyBridge from './onekey-bridge';

export default class OneKeyKeyring extends EthOneKeyKeyring {
  constructor() {
    super({
      bridge: new OneKeyBridge(),
    });
  }
}
