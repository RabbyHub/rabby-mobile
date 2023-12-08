import { ContactBookService } from "@rabby-wallet/service-address";
import { EncryptorAdapter, KeyringService } from "@rabby-wallet/service-keyring";

import { makeAppStorage } from "../storage/mmkv";
import RNEncryptor from "./encryptor";

const appStorage = makeAppStorage();

export const contactService = new ContactBookService({ storageAdapter: appStorage });

const rnEncryptor = new RNEncryptor();
const encryptor: EncryptorAdapter = {
  encrypt: rnEncryptor.encrypt,
  decrypt: rnEncryptor.decrypt,
}

const keyringState = appStorage.getItem('keyringState');
export const keyringService = new KeyringService({ encryptor });
keyringService.loadStore(keyringState || {});
keyringService.store.subscribe((value) => appStorage.setItem('keyringState', value));
