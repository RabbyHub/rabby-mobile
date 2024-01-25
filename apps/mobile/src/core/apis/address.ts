import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { keyringService } from '../services';
import { getKeyring } from './keyring';

export async function addWatchAddress(address: string) {
  const keyring = await getKeyring(KEYRING_TYPE.WatchAddressKeyring);

  keyring.setAccountToAdd(address);
  const result = await keyringService.addNewAccount(keyring);

  return result;
}

export async function removeAddress(account: KeyringAccountWithAlias) {
  const isRemoveEmptyKeyring =
    account.type !== KEYRING_TYPE.WalletConnectKeyring;

  return keyringService.removeAccount(
    account.address,
    account.type as string,
    account.brandName,
    isRemoveEmptyKeyring,
  );
}

export async function getAllAccounts() {
  return await keyringService.getAllVisibleAccountsArray();
}

export async function addWalletConnectAddress(addrses: string) {}
