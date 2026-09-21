import { findChain, findChainByEnum, findChainByID } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { openapi } from '../request';
import i18n from '@/utils/i18n';
import { EVENTS, eventBus } from '@/utils/events';
import interval from 'interval-promise';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { TransactionHistoryService } from './transactionHistory';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { callCoreService } from './serviceRegistry';

class Transaction {
  createdTime = 0;

  constructor(
    public nonce: string,
    public hash: string,
    public chain: CHAINS_ENUM,
  ) {
    this.createdTime = +new Date();
  }
}

interface TransactionWatcherStore {
  pendingTx: Record<string, Transaction>;
}

export class TransactionWatcherService extends StoreServiceBase<
  TransactionWatcherStore,
  APP_STORE_NAMES.transactions
> {
  timers = {};
  transactionHistoryService: TransactionHistoryService;
  private started = false;

  constructor(
    options: StorageAdapaterOptions & {
      transactionHistoryService: TransactionHistoryService;
    },
  ) {
    super(
      APP_STORE_NAMES.transactions,
      { pendingTx: {} },
      { storageAdapter: options?.storageAdapter },
    );
    this.transactionHistoryService = options.transactionHistoryService;
    this.mutateStore(draft => {
      draft.pendingTx ||= {};
    });

    // this._populateAvailableTxs();
  }

  hasTx(id: string) {
    return !!this.store.pendingTx[id];
  }

  // 可能有坑 在加速取消这种场景下
  addTx = (
    id: string,
    { hash, chain, nonce }: { hash: string; chain: CHAINS_ENUM; nonce: string },
  ) => {
    this.mutateStore(draft => {
      draft.pendingTx[id] = new Transaction(nonce, hash, chain);
    });

    const chainItem = findChainByEnum(chain);
    if (!chainItem) {
      throw new Error(`[transactionWatcher::addTx] chain ${chain} not found`);
    }

    // const url = format(chainItem.scanLink, hash);
    // notification.create(
    //   url,
    //   i18n.t('background.transactionWatcher.submitted'),
    //   i18n.t('background.transactionWatcher.more')
    // );
  };

  checkStatus = async (id: string) => {
    if (!this.store.pendingTx[id]) {
      return;
    }
    const { hash, chain } = this.store.pendingTx[id];
    const chainItem = findChain({ enum: chain });
    if (!chainItem || !hash) {
      return;
    }

    if (chainItem.isTestnet) {
      return callCoreService('customTestnetService', service =>
        service.getTransactionReceipt({
          chainId: chainItem.id,
          hash,
        }),
      ).catch(() => null);
    }

    return callCoreService('customRPCService', service =>
      service.defaultEthRPC({
        chainServerId: chainItem.serverId,
        method: 'eth_getTransactionReceipt',
        params: [hash],
      }),
    ).catch(() => null);
  };

  notify = async (id: string, txReceipt) => {
    if (!this.store.pendingTx[id]) {
      return;
    }
    const { hash, chain, nonce } = this.store.pendingTx[id];

    const chainItem = findChainByEnum(chain);
    if (!chainItem) {
      throw new Error(`[transactionWatcher::notify] chain ${chain} not found`);
    }

    const url = chainItem.scanLink.replace(/_s_/, hash);
    const [address] = id.split('_');
    let gasUsed: number | undefined;

    if (txReceipt) {
      gasUsed = await this.transactionHistoryService.reloadTx({
        address,
        nonce: Number(nonce),
        chainId: chainItem.id,
      });
    }

    const title =
      txReceipt.status === '0x1'
        ? i18n.t('background.transactionWatcher.completed')
        : i18n.t('background.transactionWatcher.failed');

    const content =
      txReceipt.status === '0x1'
        ? i18n.t('background.transactionWatcher.txCompleteMoreContent', {
            chain: chainItem.name,
            nonce: Number(nonce),
          })
        : i18n.t('background.transactionWatcher.txFailedMoreContent', {
            chain: chainItem.name,
            nonce: Number(nonce),
          });

    // notification.create(url, title, content, 2);

    eventBus.emit(EVENTS.TX_COMPLETED, { address, hash, gasUsed });
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
      const list = Object.keys(this.store.pendingTx);

      // order by address, chain, nonce
      const idQueue = list.sort((a, b) => {
        const [aAddress, aNonceStr, aChain] = a.split('_');
        const [bAddress, bNonceStr, bChain] = b.split('_');

        const aNonce = Number(aNonceStr);
        const bNonce = Number(bNonceStr);

        if (aAddress !== bAddress) {
          return aAddress > bAddress ? 1 : -1;
        }

        if (aChain !== bChain) {
          return aChain > bChain ? 1 : -1;
        }
        return aNonce > bNonce ? 1 : -1;
      });

      return this._queryList(idQueue);
    }, 5000);
  };

  _queryList = async (ids: string[]) => {
    for (const id of ids) {
      try {
        const txReceipt = await this.checkStatus(id);

        if (txReceipt) {
          this.notify(id, txReceipt);
          this._removeTx(id);
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  _removeTx = (id: string) => {
    delete this.timers[id];
    const [address, nonceStr, chain] = id.split('_');
    const nonce = Number(nonceStr);
    this.mutateStore(draft => {
      Object.keys(draft.pendingTx).forEach(key => {
        if (!draft.pendingTx[key]) {
          delete draft.pendingTx[key];
          return;
        }
        const [keyAddress, keyNonceStr, keyChain] = key.split('_');
        if (
          key === id ||
          (isSameAddress(keyAddress, address) &&
            keyChain === chain &&
            Number(keyNonceStr) <= nonce)
        ) {
          delete draft.pendingTx[key];
        }
      });
    });
  };

  clearPendingTx = (address: string) => {
    this.mutateStore(draft => {
      Object.keys(draft.pendingTx).forEach(key => {
        if (!draft.pendingTx[key]) {
          delete draft.pendingTx[key];
          return;
        }
        const [keyAddress] = key.split('_');
        if (isSameAddress(address, keyAddress)) {
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
        const [keyAddress, , keyNonce] = key.split('_');
        const chainItem = findChainByEnum(value.chain);
        if (
          isSameAddress(address, keyAddress) &&
          (chainId == null || +chainId === chainItem?.id) &&
          (nonce == null || +keyNonce === +nonce)
        ) {
          delete draft.pendingTx[key];
        }
      });
    });
  };

  _clearBefore = (id: string) => {
    const [address, nonceStr, chain] = id.split('_');
    const nonce = Number(nonceStr);

    this.mutateStore(draft => {
      Object.keys(draft.pendingTx).forEach(key => {
        const [keyAddress, keyNonceStr, keyChain] = key.split('_');
        if (
          isSameAddress(keyAddress, address) &&
          keyChain === chain &&
          Number(keyNonceStr) <= nonce
        ) {
          delete draft.pendingTx[key];
        }
      });
    });
  };
}
