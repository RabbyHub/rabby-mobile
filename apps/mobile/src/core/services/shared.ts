import { ContactBookService } from '@rabby-wallet/service-address';
import { makeAppStorage } from '../storage/mmkv';
import { PreferenceService } from './preference';
import { WhitelistService } from './whitelist';

export const appStorage = makeAppStorage();

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});

export const preferenceService = new PreferenceService({
  storageAdapter: appStorage,
});

export const whitelistService = new WhitelistService({
  storageAdapter: appStorage,
});
