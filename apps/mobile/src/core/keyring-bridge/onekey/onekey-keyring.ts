import { EthOneKeyKeyring } from '@rabby-wallet/eth-keyring-onekey';
import OneKeyBridge from './onekey-bridge';
console.log(111);
export class OneKeyKeyring extends EthOneKeyKeyring {
  constructor() {
    super({
      bridge: new OneKeyBridge(),
    });
  }
}
