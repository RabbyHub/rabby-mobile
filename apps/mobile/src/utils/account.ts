import { Account } from '@/core/services/preference';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringAccount } from '@rabby-wallet/keyring-utils/src/types';
import BigNumber from 'bignumber.js';

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
