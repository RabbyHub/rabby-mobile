import type {
  TypedTransaction,
} from '@ethereumjs/tx';
import type { KeyringAccount, KeyringTypeName } from './types';

export type KeyringSerializedData<T = any> = {
  type: KeyringTypeName;
  data: T;
};

export type KeyringConstructorOptions<
  T extends KeyringAccount | string = KeyringAccount | string,
> = {
  accounts?: T[];
  brandName?: string;
} & Record<string, any>;

type AccountItemPagerQueryResult = {
  address: string;
  index: string;
};
export type AccountItemWithBrandQueryResult = KeyringAccount & {
  address: string;
  brandName: string;
};

export declare class KeyringIntf {
  constructor(options?: KeyringConstructorOptions);

  static type: string;

  type: string;

  /* ===================== basic members ===================== */
  serialize(): Promise<{ accounts: string[] }>;

  deserialize(opts?: { accounts?: string[] }): Promise<void>;

  setAccountToAdd?(account: string): void;

  addAccounts(numberOfAccounts?: number): Promise<string[]>;

  addAccounts(...args: any[]): Promise<string[]>;

  getAccounts(...args: any[]): Promise<string[]>;

  removeAccount(address: string): void;

  signTransaction(
    address: string,
    transaction: any,
    ...rest: any
  ): Promise<void | TypedTransaction>;

  signPersonalMessage(address: string, message: string): Promise<void | string>;

  signTypedData(address: string, data: any, options?: { version?: string }): Promise<void>;

  /* ===================== optional members ===================== */

  publicKey?: string;

  /* for HD Keyring */
  byImport?: boolean;

  activeAccounts?<T extends string | KeyringAccount>(
    indexes: number[],
  ): Promise<T[]>;

  getFirstPage?<T extends string | AccountItemPagerQueryResult>(): Promise<T[]>;

  getNextPage?<T extends string | AccountItemPagerQueryResult>(): Promise<T[]>;

  /* for some hardware wallet */
  unlock?(hdPath?: string | number): Promise<string | void>;
  // unlock?(haIndex?: number): Promise<string | void>;

  unlock?(...args: any[]): Promise<any | void>;

  getAccountsWithBrand?(
    ...args: any[]
  ): Promise<AccountItemWithBrandQueryResult[]>;

  [P: string]: any;
}
