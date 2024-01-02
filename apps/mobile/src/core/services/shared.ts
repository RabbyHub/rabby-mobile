import { ContactBookService } from '@rabby-wallet/service-address';
import { makeAppStorage } from '../storage/mmkv';
import { PreferenceService } from './preference';
import { WhitelistService } from './whitelist';
import { DappService } from '@rabby-wallet/service-dapp';
import { NotificationService } from './notification';
import { TransactionHistoryService } from './transactionHistory';

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

export const dappService = new DappService({
  storageAdapter: appStorage,
});

export const notificationService = new NotificationService();

export const transactionHistoryService = new TransactionHistoryService({
  storageAdapter: appStorage,
});
