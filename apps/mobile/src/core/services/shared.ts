import { ContactBookService } from '@rabby-wallet/service-address';
import { makeAppStorage } from '../storage/mmkv';

export const appStorage = makeAppStorage();

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});
