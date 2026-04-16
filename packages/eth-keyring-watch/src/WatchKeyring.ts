import { EventEmitter } from 'events';
import { addHexPrefix, bufferToHex, isValidAddress } from 'ethereumjs-util';
import {
  KeyringConstructorOptions,
  KeyringIntf,
} from '@rabby-wallet/keyring-utils';

const keyringType = 'Watch Address' as const;

function sanitizeHex(hex: string): string {
  hex = hex.substring(0, 2) === '0x' ? hex.substring(2) : hex;
  if (hex === '') {
    return '';
  }
  hex = hex.length % 2 !== 0 ? '0' + hex : hex;
  return '0x' + hex;
}

class WatchKeyring extends EventEmitter implements KeyringIntf {
  static type = keyringType;
  type = keyringType;
  accounts: string[] = [];
  accountToAdd: string = '';

  constructor(opts: KeyringConstructorOptions<string> = {}) {
    super();
    this.deserialize(opts);
  }

  serialize(): Promise<{ accounts: string[] }> {
    return Promise.resolve({
      accounts: this.accounts,
    });
  }

  async deserialize(opts?: { accounts?: string[] }): Promise<void> {
    if (opts?.accounts) {
      this.accounts = opts.accounts;
    }
  }

  setAccountToAdd(account: string): void {
    this.accountToAdd = account;
  }

  async addAccounts(): Promise<string[]> {
    if (!isValidAddress(this.accountToAdd)) {
      throw new Error("The address you're trying to import is invalid");
    }
    const prefixedAddress: string = addHexPrefix(this.accountToAdd);

    if (
      this.accounts
        .map(x => x.toLowerCase())
        .includes(prefixedAddress.toLowerCase())
    ) {
      const error = new Error(prefixedAddress);
      error.name = 'DuplicateAccountError';
      throw error;
    }

    this.accounts.push(prefixedAddress);

    return [prefixedAddress];
  }

  async signTransaction(address: string, transaction: any) {
    // TODO: split by protocol(walletconnect, cold wallet, etc)
    throw new Error('Can not sign with watch address');
  }

  async signPersonalMessage(address: string, message: string): Promise<void> {
    throw new Error('Can not sign with watch address');
  }

  async signTypedData(address: string, data: any): Promise<void> {
    throw new Error('Can not sign with watch address');
  }

  async getAccounts(): Promise<string[]> {
    return this.accounts.slice();
  }

  removeAccount(address: string): void {
    if (
      !this.accounts.map(a => a.toLowerCase()).includes(address.toLowerCase())
    ) {
      throw new Error(`Address ${address} not found in watch keyring`);
    }
    this.accounts = this.accounts.filter(
      a => a.toLowerCase() !== address.toLowerCase(),
    );
  }

  _normalize(buf: Buffer | string): string {
    return sanitizeHex(
      typeof buf === 'string' ? buf : bufferToHex(buf).toString(),
    );
  }
}

export default WatchKeyring;
