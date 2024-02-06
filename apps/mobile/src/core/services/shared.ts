import { makeAppStorage } from '../storage/mmkv';

import { ContactBookService } from '@rabby-wallet/service-address';

import { findChainByID } from '@/utils/chain';
import { DappService } from './dappService';
import { NotificationService } from './notification';
import { PreferenceService } from './preference';
import { SecurityEngineService } from './securityEngine';
import { TransactionBroadcastWatcherService } from './transactionBroadcastWatcher';
import { TransactionHistoryService } from './transactionHistory';
import { TransactionWatcherService } from './transactionWatcher';
import { WhitelistService } from './whitelist';
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

transactionWatcherService.roll();

const syncPendingTxs = () => {
  const pendings = transactionHistoryService
    .getTransactionGroups()
    .filter(item => item.isPending);

  pendings.forEach(item => {
    const chain = findChainByID(item.chainId);
    if (!chain || !item.maxGasTx.hash) {
      return;
    }
    const key = `${item.address}_${item.nonce}_${chain?.enum}`;

    if (transactionWatcherService.hasTx(key)) {
      return;
    }

    transactionWatcherService.addTx(key, {
      nonce: item.nonce + '',
      hash: item.maxGasTx.hash,
      chain: chain.enum,
    });
  });
};
syncPendingTxs();
export const rabbyPointsService = new RabbyPointsService({
  storageAdapter: appStorage,
});
