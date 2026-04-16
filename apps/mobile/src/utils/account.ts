import { contactService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { ellipsisAddress } from './address';

const priority = {
  [KEYRING_TYPE.HdKeyring]: 1,
  [KEYRING_TYPE.SimpleKeyring]: 2,
  [KEYRING_TYPE.LedgerKeyring]: 3,
  [KEYRING_TYPE.OneKeyKeyring]: 4,
  [KEYRING_TYPE.KeystoneKeyring]: 5,
  [KEYRING_TYPE.GnosisKeyring]: 6,
};

export function findAccountByPriority(accounts: KeyringAccountWithAlias[]) {
  return accounts.sort((item1, item2) => {
    return (priority[item1.type] || 100) - (priority[item2.type] || 100);
  })[0];
}

export { sortAccountsByBalance, filterMyAccounts } from '@/core/apis/account';

export function isWatchOrSafeAccount(account: Account | Account['type']) {
  if (!account) {
    return false;
  }

  const accType = typeof account === 'string' ? account : account.type;

  return (
    accType && [KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS].includes(accType)
  );
}

export const isAccountSupportMiniApproval = (type?: string) => {
  if (!type) {
    return false;
  }
  return (
    [
      KEYRING_CLASS.MNEMONIC,
      KEYRING_CLASS.PRIVATE_KEY,
      KEYRING_CLASS.HARDWARE.LEDGER,
      KEYRING_CLASS.HARDWARE.ONEKEY,
    ] as string[]
  ).includes(type);
};

export const isHardWareAccountAccountSupportMiniApproval = (type?: string) => {
  if (!type) {
    return false;
  }
  return (
    [KEYRING_CLASS.HARDWARE.LEDGER, KEYRING_CLASS.HARDWARE.ONEKEY] as string[]
  ).includes(type);
};

export const isAccountSupportDirectSign = (type?: string) => {
  if (!type) {
    return false;
  }
  return (
    [KEYRING_CLASS.MNEMONIC, KEYRING_CLASS.PRIVATE_KEY] as string[]
  ).includes(type);
};

export function stableSortByAddress<T extends { address: string }[] | string[]>(
  accounts: T,
) {
  return accounts.sort((a, b) => {
    const aAddr = typeof a === 'string' ? a : a.address;
    const bAddr = typeof b === 'string' ? b : b.address;
    return aAddr.localeCompare(bAddr);
  }) as T;
}

export function stableSerializeAccounts<T extends KeyringAccountWithAlias[]>(
  accounts: T,
) {
  return JSON.stringify(
    accounts.sort((a, b) => a.address.localeCompare(b.address)),
    null,
    0,
  );
}

export function stableSerializeItems<
  T extends any[],
  Sorter extends (a: T[number], b: T[number]) => number,
>(items: T, sorter: Sorter) {
  return JSON.stringify(items.sort(sorter), null, 0);
}

export function makeAccountObject<T extends Account>({
  address,
  brandName,
}: {
  address: string;
  brandName?: string;
}): T {
  return {
    address,
    brandName: brandName || KEYRING_CLASS.WATCH,
    aliasName:
      contactService.getAliasByAddress(address)?.alias ||
      ellipsisAddress(address),
    balance: 0,
    type: KEYRING_CLASS.WATCH,
  } as any as T;
}
