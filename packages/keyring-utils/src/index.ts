import type { AccountItemWithBrandQueryResult, KeyringIntf } from './intf';
import type { KeyringTypeName } from './types';

export * from './types';
export * from './account';
export * from './intf';
export * from './helper';

export class DisplayKeyring {
  type: KeyringTypeName | string = '';

  constructor(
    keyring:
      | DisplayKeyring
      | (Partial<KeyringIntf> & { type: KeyringTypeName }),
  ) {
    if (keyring instanceof DisplayKeyring) {
      // eslint-disable-next-line no-constructor-return
      return keyring;
    }
    this.getAccounts = keyring.getAccounts?.bind(keyring);
    this.activeAccounts = keyring.activeAccounts?.bind(keyring);
    this.getFirstPage = keyring.getFirstPage?.bind(keyring);
    this.getNextPage = keyring.getNextPage?.bind(keyring);
    this.unlock = keyring.unlock?.bind(keyring);
    this.getAccountsWithBrand = keyring.getAccountsWithBrand?.bind(keyring);
    this.type = keyring.type;
  }

  unlock?: () => Promise<void>;

  getFirstPage?: () => Promise<string[]>;

  getNextPage?: () => Promise<string[]>;

  getAccounts?: () => Promise<string[]>;

  getAccountsWithBrand?: () => Promise<AccountItemWithBrandQueryResult[]>;

  activeAccounts?: (indexes: number[]) => Promise<string[]>;
}

export type DisplayedKeyring = {
  type: string & KeyringTypeName;
  accounts: {
    address: string;
    brandName: string & KeyringTypeName;
    type?: string & KeyringTypeName;
    keyring?: DisplayKeyring;
    // /** @deprecated use aliasName! this field is pointless */
    // alianName?: string;
    aliasName?: string;
  }[];
  keyring: DisplayKeyring;
  byImport?: boolean;
  publicKey?: string;
};
