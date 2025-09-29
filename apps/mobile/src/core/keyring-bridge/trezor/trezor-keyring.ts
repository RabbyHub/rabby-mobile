import { EthTrezorKeyring } from '@rabby-wallet/eth-keyring-trezor';
import TrezorBridge from './trezor-bridge';

export class TrezorKeyring extends EthTrezorKeyring {
  constructor() {
    super({
      bridge: new TrezorBridge(),
    });
  }
}
