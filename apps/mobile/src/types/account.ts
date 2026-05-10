import type {
  DisplayedKeyring,
  KeyringAccount,
} from '@rabby-wallet/keyring-utils';

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
  evmBalance?: number;
};

export type Account = KeyringAccountWithAlias & {
  /**
   * @description property for HDKeyring and hardware keyring to indicate the index of the account
   */
  index?: number | undefined;
};

export type IPinAddress = {
  brandName: Account['brandName'];
  address: Account['address'];
};

type IDisplayedAccount = Required<DisplayedKeyring['accounts'][number]>;

export type IDisplayedAccountWithBalance = IDisplayedAccount & {
  balance: number;
  byImport?: boolean;
  publicKey?: string;
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};
