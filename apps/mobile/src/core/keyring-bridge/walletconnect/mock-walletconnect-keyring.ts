import { addHexPrefix } from '@ethereumjs/util';
import { isAddress } from 'web3-utils';

export interface Account {
  brandName: string;
  address: string;
  realBrandName?: string;
  realBrandUrl?: string;
}

/**
 * WalletConnectKeyring is deprecated, add mock class for backward compatibility
 */
export class MockWalletConnectKeyring {
  static type = 'WalletConnect';
  type = 'WalletConnect';

  _accounts: Account[] = [];
  accountToAdd: Account | null = null;
  v2Whitelist: string[] = [];

  get accounts() {
    return this._accounts;
  }

  set accounts(accounts: Account[]) {
    this._accounts = accounts;
  }

  serialize() {
    return Promise.resolve({
      accounts: this.accounts,
    });
  }

  async deserialize(opts: { accounts?: Account[] }) {
    if (opts?.accounts) {
      this.accounts = opts.accounts;
    }
  }

  setAccountToAdd = (account: Account) => {
    this.accountToAdd = {
      ...account,
      address: account.address.toLowerCase(),
    };
  };

  async addAccounts(n: number) {
    if (!this.accountToAdd) {
      throw new Error('There is no address to add');
    }

    if (!isAddress(this.accountToAdd.address)) {
      throw new Error("The address you're trying to import is invalid");
    }
    const prefixedAddress = addHexPrefix(this.accountToAdd.address);

    this.accounts.push({
      address: prefixedAddress,
      brandName: this.accountToAdd.brandName,
      realBrandName: this.accountToAdd.realBrandName,
      realBrandUrl: this.accountToAdd.realBrandUrl,
    });

    return [prefixedAddress];
  }

  async getAccounts(): Promise<string[]> {
    return this.accounts.map(acct => acct.address).slice();
  }

  async getAccountsWithBrand(): Promise<Account[]> {
    return this.accounts;
  }

  private findAccount(account: Account) {
    return this.accounts?.find(
      acc =>
        acc.address.toLowerCase() === account.address.toLowerCase() &&
        acc.brandName === account.brandName,
    );
  }

  removeAccount(address: string, brandName: string): void {
    if (
      !this.findAccount({
        address,
        brandName,
      })
    ) {
      throw new Error(`Address ${address} not found in watch keyring`);
    }
    this.accounts = this.accounts.filter(
      a =>
        !(
          a.address.toLowerCase() === address.toLowerCase() &&
          a.brandName === brandName
        ),
    );
  }
}
