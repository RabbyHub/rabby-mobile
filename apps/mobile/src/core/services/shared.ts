import * as Sentry from '@sentry/react-native';
import {
  appStorage,
  keyringStorage,
  normalizeKeyringState,
} from '../storage/mmkv';
import { APP_MMKV_KEYS } from '../storage/mmkvConstants';

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
import { perfEvents } from '../utils/perf';
import { KeyringIntf } from '@rabby-wallet/keyring-utils';
import { AutoConnectService } from './autoConnect';
import { openapi } from '../request';
import { registerServiceReady, SERVICE_READY_KEYS } from './serviceReady';

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
      if (__DEV__) {
        console.error(msg);
      }
      Sentry.captureException(new Error(msg));
    }
  } catch (error) {
    Sentry.captureException(
      new Error('Failed to get preference from appStorage: ' + error),
    );
  }
}

try_catch_issue_on_preference({ pos: 'before_preference' });
GnosisKeyring.setOpenapiService(openapi);

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
registerServiceReady(SERVICE_READY_KEYS.contactService, contactService);
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
registerServiceReady(SERVICE_READY_KEYS.keyringService, keyringService);
keyringService.loadStore(keyringState || {});

keyringService.store.subscribe(value => {
  // // leave here to test migrate legacyData to keyringData
  // if (__DEV__) {
  //   appStorage.setItem(APP_MMKV_KEYS.LEGACY_KEYRING_STATE, value);
  // }

  keyringStorage.clearAll();
  // keyringStorage.flushToDisk?.();
  keyringStorage.setItem(APP_MMKV_KEYS.LEGACY_KEYRING_STATE, value);
});

export const dappService = new DappService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.dappService, dappService);

export const browserHistoryService = new BrowserHistoryService({
  storageAdapter: appStorage,
});
registerServiceReady(
  SERVICE_READY_KEYS.browserHistoryService,
  browserHistoryService,
);

export const sessionService = new SessionService({
  dappService,
});
registerServiceReady(SERVICE_READY_KEYS.sessionService, sessionService);

export const preferenceService = new PreferenceService({
  storageAdapter: appStorage,
  keyringService,
  sessionService,
});
registerServiceReady(SERVICE_READY_KEYS.preferenceService, preferenceService);

preferenceService.setBeforeSetKV((k, v) => {
  perfEvents.emit('PREFERENCE_UPDATED', {
    key: k,
    value: v,
  });
});

try_catch_issue_on_preference({ pos: 'after_preference' });

export const whitelistService = new WhitelistService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.whitelistService, whitelistService);

export const transactionHistoryService = new TransactionHistoryService({
  storageAdapter: appStorage,
  preferenceService,
});
registerServiceReady(
  SERVICE_READY_KEYS.transactionHistoryService,
  transactionHistoryService,
);

export const notificationService = new NotificationService({
  preferenceService,
  transactionHistoryService,
});
registerServiceReady(
  SERVICE_READY_KEYS.notificationService,
  notificationService,
);

export const transactionWatcherService = new TransactionWatcherService({
  storageAdapter: appStorage,
  transactionHistoryService,
});
registerServiceReady(
  SERVICE_READY_KEYS.transactionWatcherService,
  transactionWatcherService,
);

export const transactionBroadcastWatcherService =
  new TransactionBroadcastWatcherService({
    storageAdapter: appStorage,
    transactionHistoryService,
    transactionWatcherService,
  });
registerServiceReady(
  SERVICE_READY_KEYS.transactionBroadcastWatcherService,
  transactionBroadcastWatcherService,
);

export const securityEngineService = new SecurityEngineService({
  storageAdapter: appStorage,
});
registerServiceReady(
  SERVICE_READY_KEYS.securityEngineService,
  securityEngineService,
);

export const autoConnectService = new AutoConnectService({
  dappService,
  contactService,
  keyringService,
  preferenceService,
  transactionHistoryService,
});
registerServiceReady(SERVICE_READY_KEYS.autoConnectService, autoConnectService);

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
registerServiceReady(SERVICE_READY_KEYS.rabbyPointsService, rabbyPointsService);

export const swapService = new SwapService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.swapService, swapService);

export const hdKeyringService = new HDKeyringService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.hdKeyringService, hdKeyringService);

export const bridgeService = new BridgeService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.bridgeService, bridgeService);

export const gasAccountService = new GasAccountService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.gasAccountService, gasAccountService);

export const offlineChainService = new OfflineChainService({
  storageAdapter: appStorage,
});
registerServiceReady(
  SERVICE_READY_KEYS.offlineChainService,
  offlineChainService,
);

export const browserService = new BrowserService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.browserService, browserService);

export const metamaskModeService = new MetamaskModeService({
  storageAdapter: appStorage,
});
registerServiceReady(
  SERVICE_READY_KEYS.metamaskModeService,
  metamaskModeService,
);

export const syncChainService = new SyncChainService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.syncChainService, syncChainService);

export const perpsService = new PerpsService({
  storageAdapter: appStorage,
  keyringService,
});
registerServiceReady(SERVICE_READY_KEYS.perpsService, perpsService);

export const lendingService = new LendingService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.lendingService, lendingService);

export const currencyService = new CurrencyService({
  storageAdapter: appStorage,
});
registerServiceReady(SERVICE_READY_KEYS.currencyService, currencyService);

export { default as debugLogService } from './debugLogService';

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
