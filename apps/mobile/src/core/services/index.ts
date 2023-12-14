import { ContactBookService } from '@rabby-wallet/service-address';
import {
  EncryptorAdapter,
  KeyringService,
} from '@rabby-wallet/service-keyring';

import { makeAppStorage } from '../storage/mmkv';
import RNEncryptor from './encryptor';
import { PreferenceService } from './preference';
import { WhitelistService } from './whitelist';

const appStorage = makeAppStorage();

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});
export const preferenceService = new PreferenceService({
  storageAdapter: appStorage,
});

export const whitelistService = new WhitelistService({
  storageAdapter: appStorage,
});

const rnEncryptor = new RNEncryptor();
const encryptor: EncryptorAdapter = {
  encrypt: rnEncryptor.encrypt,
  decrypt: rnEncryptor.decrypt,
};

const keyringState = appStorage.getItem('keyringState');
export const keyringService = new KeyringService({ encryptor });
keyringService.loadStore(keyringState || {});
keyringService.store.subscribe(value =>
  appStorage.setItem('keyringState', value),
);
