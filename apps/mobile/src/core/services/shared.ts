import {
  appStorage,
  keyringStorage,
  normalizeKeyringState,
} from '../storage/mmkv';

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
import { GnosisKeyring } from '@rabby-wallet/eth-keyring-gnosis';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KeyringService } from '@rabby-wallet/service-keyring';
import RNEncryptor from './encryptor';
import { onCreateKeyring, onSetAddressAlias } from './keyringParams';
import { RabbyPointsService } from './rabbyPoints';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import { SwapService } from './swap';
import { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import SimpleKeyring from '@rabby-wallet/eth-simple-keyring';
import HDKeyring from '@rabby-wallet/eth-hd-keyring';
import { HDKeyringService } from './hdKeyringService';
import { BridgeService } from './bridge';

const keyringState = normalizeKeyringState().keyringData;

// TODO: add other keyring classes
const keyringClasses = [
  WalletConnectKeyring,
  WatchKeyring,
  LedgerKeyring,
  KeystoneKeyring,
  OneKeyKeyring,
  GnosisKeyring,
  SimpleKeyring,
  HDKeyring,
] as any;

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});

export const appEncryptor = new RNEncryptor();

export const keyringService = new KeyringService({
  encryptor: new RNEncryptor(),
  keyringClasses,
  onSetAddressAlias,
  onCreateKeyring,
  contactService,
});
keyringService.loadStore(keyringState || {});

keyringService.store.subscribe(value => {
  // // leave here to test migrate legacyData to keyringData
  // if (__DEV__) {
  //   appStorage.setItem('keyringState', value);
  // }

  keyringStorage.clearAll();
  // keyringStorage.flushToDisk?.();
  keyringStorage.setItem('keyringState', value);
});

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

export const swapService = new SwapService({
  storageAdapter: appStorage,
});

export const hdKeyringService = new HDKeyringService({
  storageAdapter: appStorage,
});

export const bridgeService = new BridgeService({
  storageAdapter: appStorage,
});
