import type { KeyringAccount } from '@rabby-wallet/keyring-utils';

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
