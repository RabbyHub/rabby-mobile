import { KEYRING_TYPE } from "@rabby-wallet/keyring-utils";
import { keyringService } from "../services";
import { KeyringInstance } from "@rabby-wallet/service-keyring";

export async function addWatchAddress(address: string) {
  let keyring: KeyringInstance | null = null;
  let isNewKey = false;

  keyring = keyringService.getKeyringByType(KEYRING_TYPE.WatchAddressKeyring) as any as KeyringInstance;
  if (!keyring) {
    const WatchKeyring = keyringService.getKeyringClassForType(KEYRING_TYPE.WatchAddressKeyring);
    keyring = new WatchKeyring();
    isNewKey = true;
  }

  keyring.setAccountToAdd(address);

  const result = await keyringService.addNewAccount(keyring);
  if (isNewKey) await keyringService.addKeyring(keyring);

  return result;
}

export async function removeAddress(address: string) {
  return keyringService.removeAccount(address, KEYRING_TYPE.WatchAddressKeyring);
}

export async function getAllAccounts() {
  return await keyringService.getAllVisibleAccountsArray();
}
