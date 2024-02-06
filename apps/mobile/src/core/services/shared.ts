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

export const transactionWatcherService = new TransactionWatcherService({
  storageAdapter: appStorage,
});

export const transactionBroadcastWatcherService =
  new TransactionBroadcastWatcherService({
    storageAdapter: appStorage,
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
