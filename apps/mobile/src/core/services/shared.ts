import { makeAppStorage } from '../storage/mmkv';

import { ContactBookService } from '@rabby-wallet/service-address';
import { DappService } from '@rabby-wallet/service-dapp';

import { PreferenceService } from './preference';
import { WhitelistService } from './whitelist';
import { NotificationService } from './notification';
import { TransactionHistoryService } from './transactionHistory';
import { SecurityEngineService } from './securityEngine';

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

export const securityEngineService = new SecurityEngineService();
