import { makeAppStorage } from '../storage/mmkv';

import { ContactBookService } from '@rabby-wallet/service-address';

import { PreferenceService } from './preference';
import { WhitelistService } from './whitelist';
import { NotificationService } from './notification';
import { TransactionHistoryService } from './transactionHistory';
import { SecurityEngineService } from './securityEngine';
import { TransactionWatcherService } from './transactionWatcher';
import { TransactionBroadcastWatcherService } from './transactionBroadcastWatcher';
import { DappService } from './dappService';
import { SessionService } from './session';
import WatchKeyring from '@rabby-wallet/eth-keyring-watch';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import {
  EncryptorAdapter,
  KeyringService,
} from '@rabby-wallet/service-keyring';
import RNEncryptor from './encryptor';
import { onCreateKeyring, onSetAddressAlias } from './keyringParams';
import { RabbyPointsService } from './rabbyPoints';

export const appStorage = makeAppStorage();
const keyringState = appStorage.getItem('keyringState');

const rnEncryptor = new RNEncryptor();
const encryptor: EncryptorAdapter = {
  encrypt: rnEncryptor.encrypt,
  decrypt: rnEncryptor.decrypt,
};
// TODO: add other keyring classes
const keyringClasses = [WalletConnectKeyring, WatchKeyring] as any;

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});

export const keyringService = new KeyringService({
  encryptor,
  keyringClasses,
  onSetAddressAlias,
  onCreateKeyring,
  contactService,
});
keyringService.loadStore(keyringState || {});
keyringService.store.subscribe(value =>
  appStorage.setItem('keyringState', value),
);

export const dappService = new DappService({
  storageAdapter: appStorage,
});

export const sessionService = new SessionService({
  dappService,
});

export const preferenceService = new PreferenceService({
  storageAdapter: appStorage,
  keyringService,
  sessionService,
});

export const whitelistService = new WhitelistService({
  storageAdapter: appStorage,
});

export const transactionHistoryService = new TransactionHistoryService({
  storageAdapter: appStorage,
});

export const notificationService = new NotificationService({
  preferenceService,
  transactionHistoryService,
});

export const transactionWatcherService = new TransactionWatcherService({
  storageAdapter: appStorage,
  transactionHistoryService,
});

export const transactionBroadcastWatcherService =
  new TransactionBroadcastWatcherService({
    storageAdapter: appStorage,
    transactionHistoryService,
    transactionWatcherService,
  });

export const securityEngineService = new SecurityEngineService({
  storageAdapter: appStorage,
});

export const rabbyPointsService = new RabbyPointsService({
  storageAdapter: appStorage,
});
