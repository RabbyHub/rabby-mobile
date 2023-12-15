import { ContactBookService } from '@rabby-wallet/service-address';
import { DappService } from '@rabby-wallet/service-dapp';
import {
  EncryptorAdapter,
  KeyringService,
} from '@rabby-wallet/service-keyring';

import { makeAppStorage } from '../storage/mmkv';
import RNEncryptor from './encryptor';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import { INITIAL_OPENAPI_URL, INITIAL_TESTNET_OPENAPI_URL } from '@/constant';

const appStorage = makeAppStorage();

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});

export const openapiService = new OpenApiService({
  store: {
    host: INITIAL_OPENAPI_URL,
    testnetHost: INITIAL_TESTNET_OPENAPI_URL,
  },
});
openapiService.init();

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

export const dappService = new DappService({ storageAdapter: appStorage });
