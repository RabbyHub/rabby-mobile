import * as Sentry from '@sentry/react-native';
import {
  appStorage,
  keyringStorage,
  normalizeKeyringState,
} from '../storage/mmkv';

import {
  ContactBookService,
  ContactBookStore,
} from '@rabby-wallet/service-address';

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
export { customTestnetService } from './customTestnetService';
export { customRPCService } from './customRPCService';
import { BridgeService } from './bridge';
import { GasAccountService } from './gasAccount';
import { BrowserHistoryService } from './browserHistoryService';
import { MockWalletConnectKeyring } from '../keyring-bridge/walletconnect/mock-walletconnect-keyring';
import { migrateAppStorage, migrateServices } from '@/migrations/migrations';
import { OfflineChainService } from './offlineChain';
import { BrowserService } from './browserService';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { TrezorKeyring } from '../keyring-bridge/trezor/trezor-keyring';
import { MetamaskModeService } from './metamaskModeService';
import { SyncChainService } from './syncChainService';
import { PerpsService } from './perpsService';
import { CurrencyService } from './currencyService';
import { LendingService } from './lendingService';
import { SAFE_API_KEY } from '@/constant/env';
import { perfEvents } from '../utils/perf';
import { KeyringIntf } from '@rabby-wallet/keyring-utils';

migrateAppStorage(appStorage);

const keyringState = normalizeKeyringState().keyringData;

function try_catch_issue_on_preference({
  pos,
}: {
  pos: 'before_preference' | 'after_preference';
}) {
  try {
    const preferenceData = appStorage.getItem(APP_STORE_NAMES.preference);
    if (!preferenceData && keyringState) {
      const msg = `[${pos}] keyringState is not empty but preference is empty`;
      if (__DEV__) console.error(msg);
      Sentry.captureException(new Error(msg));
    }
  } catch (error) {
    Sentry.captureException(
      new Error('Failed to get preference from appStorage: ' + error),
    );
  }
}

try_catch_issue_on_preference({ pos: 'before_preference' });

GnosisKeyring.setApiKey(SAFE_API_KEY);

const keyringClasses = [
  MockWalletConnectKeyring,
  WatchKeyring,
  LedgerKeyring,
  KeystoneKeyring,
  OneKeyKeyring,
  GnosisKeyring,
  SimpleKeyring,
  HDKeyring,
  TrezorKeyring,
] as (typeof KeyringIntf)[];

export const contactService = new ContactBookService({
  storageAdapter: appStorage,
});
contactService.setBeforeSetKV((k, v) => {
  switch (k) {
    case 'aliases': {
      const aliases = v as unknown as ContactBookStore['aliases'];
      perfEvents.emit('CONTACTS_ALIASES_UPDATE', {
        nextState: aliases,
      });
      break;
    }
  }
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

export const browserHistoryService = new BrowserHistoryService({
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

try_catch_issue_on_preference({ pos: 'after_preference' });

export const whitelistService = new WhitelistService({
  storageAdapter: appStorage,
});

export const transactionHistoryService = new TransactionHistoryService({
  storageAdapter: appStorage,
  preferenceService,
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

export const gasAccountService = new GasAccountService({
  storageAdapter: appStorage,
});

export const offlineChainService = new OfflineChainService({
  storageAdapter: appStorage,
});

export const browserService = new BrowserService({
  storageAdapter: appStorage,
});

export const metamaskModeService = new MetamaskModeService({
  storageAdapter: appStorage,
});

export const syncChainService = new SyncChainService({
  storageAdapter: appStorage,
});

export const perpsService = new PerpsService({
  storageAdapter: appStorage,
});

export const lendingService = new LendingService({
  storageAdapter: appStorage,
});

export const currencyService = new CurrencyService({
  storageAdapter: appStorage,
});

migrateServices({
  contactBook: contactService,
  dapps: dappService,
  bridge: bridgeService,
  browserHistory: browserHistoryService,
  preference: preferenceService,
  whitelist: whitelistService,
  txHistory: transactionHistoryService,
  transactions: transactionWatcherService,
  transactionBroadcastWatcher: transactionBroadcastWatcherService,
  securityEngine: securityEngineService,
  RabbyPoints: rabbyPointsService,
  swap: swapService,
  HDKeyRingLastAddAddrTime: hdKeyringService,
  gasAccount: gasAccountService,
  offlineChain: offlineChainService,
  browser: browserService,
  metamaskMode: metamaskModeService,
  syncChain: syncChainService,
  perps: perpsService,
  lending: lendingService,
  currency: currencyService,
});
