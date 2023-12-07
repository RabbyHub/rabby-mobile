export interface Account {
  type: string;
  address: string;
  brandName: string;
  aliasName?: string;
  displayBrandName?: string;
  realBrandName?: string;
  index?: number;
  balance?: number;
}

class DisplayKeyring {
  type = '';

  constructor(keyring: DisplayKeyring) {
    this.getAccounts = keyring.getAccounts?.bind(keyring);
    this.activeAccounts = keyring.activeAccounts?.bind(keyring);
    this.getFirstPage = keyring.getFirstPage?.bind(keyring);
    this.getNextPage = keyring.getNextPage?.bind(keyring);
    this.unlock = keyring.unlock?.bind(keyring);
    this.getAccountsWithBrand = keyring.getAccountsWithBrand?.bind(keyring);
    this.type = keyring.type;
  }

  unlock: () => Promise<void>;

  getFirstPage: () => Promise<string[]>;

  getNextPage: () => Promise<string[]>;

  getAccounts: () => Promise<string[]>;

  getAccountsWithBrand: () => Promise<Account[]>;

  activeAccounts: (indexes: number[]) => Promise<string[]>;
}

export default DisplayKeyring;
