export * from './types';
export * from './intf';

import { AccountItemWithBrandQueryResult, KeyringIntf } from './intf';
import { KeyringTypeName } from './types';

export class DisplayKeyring {
  type: KeyringTypeName | string = '';

  constructor(keyring: KeyringIntf) {
    if (keyring instanceof DisplayKeyring) {
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

export interface DisplayedKeryring {
  type: string | KeyringTypeName;
  accounts: {
    address: string;
    brandName: string | KeyringTypeName;
    type?: string | KeyringTypeName;
    keyring?: DisplayKeyring;
    alianName?: string;
  }[];
  keyring: DisplayKeyring;
  byImport?: boolean;
  publicKey?: string;
}
