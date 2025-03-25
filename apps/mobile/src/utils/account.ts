import { Account } from '@/core/services/preference';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringAccount } from '@rabby-wallet/keyring-utils/src/types';
import BigNumber from 'bignumber.js';

export function findAccountByPriority(accounts: KeyringAccountWithAlias[]) {
  const priority = {
    [KEYRING_TYPE.HdKeyring]: 1,
    [KEYRING_TYPE.SimpleKeyring]: 2,
    [KEYRING_TYPE.LedgerKeyring]: 3,
    [KEYRING_TYPE.OneKeyKeyring]: 4,
    [KEYRING_TYPE.KeystoneKeyring]: 5,
    [KEYRING_TYPE.GnosisKeyring]: 6,
  };

  return accounts.sort((item1, item2) => {
    return (priority[item1.type] || 100) - (priority[item2.type] || 100);
  })[0];
}

export const sortAccountsByBalance = <
  T extends { address: string; balance?: number }[],
>(
  accounts: T,
) => {
  return accounts.sort((a, b) => {
    return new BigNumber(b?.balance || 0)
      .minus(new BigNumber(a?.balance || 0))
      .toNumber();
  });
};

export function isWatchOrSafeAccount(account: Account | Account['type']) {
  if (!account) {
    return false;
  }

  const accType = typeof account === 'string' ? account : account.type;

  return (
    accType && [KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS].includes(accType)
  );
}
export const filterMyAccounts = <
  T extends KeyringAccount | KeyringAccountWithAlias,
>(
  accounts: T[],
) => {
  return accounts.filter(
    a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
  );
};
