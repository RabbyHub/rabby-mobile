import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { keyringService, preferenceService } from '../services';
import { getKeyring } from './keyring';
import { addressUtils } from '@rabby-wallet/base-utils';

export async function addWatchAddress(address: string) {
  const keyring = await getKeyring(KEYRING_TYPE.WatchAddressKeyring);

  keyring.setAccountToAdd(address);
  const result = await keyringService.addNewAccount(keyring);

  return result;
}

/**
 * @deprecated just for migration, use `addWatchAddress` instead
 */
export const addWatchAddressOnly = addWatchAddress;

export function getCurrentAccount() {
  return preferenceService.getCurrentAccount();
}

async function resetCurrentAccount() {
  const [account] = await getAllAccounts();
  if (account) {
    preferenceService.setCurrentAccount(account);
  } else {
    preferenceService.setCurrentAccount(null);
  }
}

export async function removeAddress(account: KeyringAccountWithAlias) {
  const isRemoveEmptyKeyring =
    account.type !== KEYRING_TYPE.WalletConnectKeyring;

  preferenceService.removeAddressBalance(account.address);

  await keyringService.removeAccount(
    account.address,
    account.type as string,
    account.brandName,
    isRemoveEmptyKeyring,
  );

  const currentAccount = getCurrentAccount();

  if (
    addressUtils.isSameAddress(
      currentAccount?.address || '',
      account?.address,
    ) &&
    currentAccount?.type === account.type &&
    currentAccount?.brandName === account.brandName
  ) {
    await resetCurrentAccount();
  }
}

export async function getAllAccounts() {
  return await keyringService.getAllVisibleAccountsArray();
}

export async function addWalletConnectAddress(addrses: string) {}
