import { EthOneKeyKeyring } from '@rabby-wallet/eth-keyring-onekey';
import OneKeyBridge from './onekey-bridge';

export class OneKeyKeyring extends EthOneKeyKeyring {
  constructor() {
    super({
      bridge: new OneKeyBridge(),
    });
  }
}
