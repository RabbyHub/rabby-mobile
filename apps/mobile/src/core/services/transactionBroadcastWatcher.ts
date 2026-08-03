import { findChainByID } from '@/utils/chain';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { TxRequest } from '@rabby-wallet/rabby-api/dist/types';
import { openapi, testOpenapi } from '../request';
import { flatten } from 'lodash';
import interval from 'interval-promise';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { EVENTS, eventBus } from '@/utils/events';
import type { TransactionHistoryService } from './transactionHistory';
import type { TransactionWatcherService } from './transactionWatcher';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

interface WatcherItem {
  address: string;
  chainId: number;
  nonce: string;
  reqId: string;
}

interface TransactionBroadcastWatcherStore {
  pendingTx: Record<string, WatcherItem>;
}

export class TransactionBroadcastWatcherService extends StoreServiceBase<
  TransactionBroadcastWatcherStore,
  APP_STORE_NAMES.transactionBroadcastWatcher
> {
  timers = {};
  private started = false;

  transactionHistoryService: TransactionHistoryService;
  transactionWatcherService: TransactionWatcherService;

  constructor(
    options: StorageAdapaterOptions & {
      transactionHistoryService: TransactionHistoryService;
      transactionWatcherService: TransactionWatcherService;
    },
  ) {
    super(
      APP_STORE_NAMES.transactionBroadcastWatcher,
      { pendingTx: {} },
      { storageAdapter: options?.storageAdapter },
    );
    this.transactionHistoryService = options?.transactionHistoryService;
    this.transactionWatcherService = options?.transactionWatcherService;
  }

  addTx = (reqId: string, data: WatcherItem) => {
    this.mutateStore(draft => {
      draft.pendingTx[reqId] = data;
    });
  };

  updateTx = (id: string, data: Partial<WatcherItem>) => {
    const tx = this.store.pendingTx[id];
    if (!tx) {
      return;
    }
    this.mutateStore(draft => {
      Object.assign(draft.pendingTx[id], data);
    });
  };

  queryTxRequests = async () => {
    const list = Object.values(this.store.pendingTx);
    if (list.length <= 0) {
      return;
    }
    const { testnetList, mainnetList } = list.reduce(
      (res, item) => {
        const chainItem = findChainByID(item.chainId);

        if (chainItem?.isTestnet) {
          res.testnetList.push(item);
        } else {
          res.mainnetList.push(item);
        }
        return res;
      },
      { testnetList: [] as WatcherItem[], mainnetList: [] as WatcherItem[] },
    );

    const res = await Promise.all([
      testnetList?.length
        ? testOpenapi
            .getTxRequests(testnetList.map(item => item.reqId))
            .catch(() => [] as TxRequest[])
        : ([] as TxRequest[]),
      mainnetList?.length
        ? openapi
            .getTxRequests(mainnetList.map(item => item.reqId))
            .catch(() => [] as TxRequest[])
        : ([] as TxRequest[]),
    ]);

    const addressList: string[] = [];
    flatten(res).forEach(item => {
      if (
        item.is_finished ||
        item.is_withdraw ||
        (item.push_status === 'failed' && item.is_finished) ||
        item.tx_id
      ) {
        this.removeTx(item.id);
        this.transactionHistoryService.updateTxByTxRequest(item);
        addressList.push(item.signed_tx.from);
        if (item.tx_id) {
          const chain = findChainByID(item.signed_tx.chainId);
          if (chain) {
            // swapService.postSwap(chain?.enum, item.tx_id, item.signed_tx);
          }
        }
      }
      if (item.tx_id) {
        const chain = findChainByID(item.signed_tx.chainId);
        if (!chain) {
          console.error('chain not found');
          return;
        }
        this.transactionWatcherService.addTx(
          `${item.signed_tx.from}_${item.signed_tx.nonce}_${chain.enum}`,
          {
            nonce: item.signed_tx.nonce,
            hash: item.tx_id,
            chain: chain.enum,
          },
        );
      }
      if (addressList.length) {
        eventBus.emit(EVENTS.broadcastToUI, {
          method: EVENTS.RELOAD_TX,
          params: {
            addressList: addressList,
          },
        });
      }
    });
  };

  removeTx = (reqId: string) => {
    this.mutateStore(draft => {
      delete draft.pendingTx[reqId];
    });
  };

  // fetch pending txs status every 5s
  start = () => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.roll();
  };

  roll = () => {
    interval(async () => {
      this.queryTxRequests();
    }, 5000);
  };

  clearPendingTx = (address: string) => {
    this.mutateStore(draft => {
      Object.entries(draft.pendingTx).forEach(([key, value]) => {
        if (!value) {
          delete draft.pendingTx[key];
          return;
        }
        if (isSameAddress(address, value.address)) {
          delete draft.pendingTx[key];
        }
      });
    });
  };
  removeLocalPendingTx = ({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId?: number;
    nonce?: number;
  }) => {
    this.mutateStore(draft => {
      Object.entries(draft.pendingTx).forEach(([key, value]) => {
        if (!value) {
          delete draft.pendingTx[key];
          return;
        }
        if (
          isSameAddress(address, value.address) &&
          (chainId == null || +chainId === value.chainId) &&
          (nonce == null || +value.nonce === +nonce)
        ) {
          delete draft.pendingTx[key];
        }
      });
    });
  };
}
