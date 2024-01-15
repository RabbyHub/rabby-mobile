import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import {
  ExplainTxResponse,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import { Object as ObjectType } from 'ts-toolbelt';
import { findMaxGasTx } from '../utils/tx';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { sortBy, minBy, maxBy } from 'lodash';

export interface TransactionHistoryItem {
  address: string;
  chainId: number;
  nonce: number;

  rawTx: Tx;
  createdAt: number;
  hash?: string;
  gasUsed?: number;
  // site?: ConnectedSite;
  site?: any;

  pushType?: TxPushType;
  reqId?: string;

  isPending?: boolean;
  isWithdrawed?: boolean;
  isFailed?: boolean;
  isSubmitFailed?: boolean;

  // explain?: TransactionGroup['explain'];
  // action?: TransactionGroup['action'];
}

export interface TransactionSigningItem {
  rawTx: Tx;
  explain?: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: any;
    requiredData: any;
    // actionData: ParsedActionData;
    // requiredData: ActionRequireData;
  };
  id: string;
  isSubmitted?: boolean;
}

interface TxHistoryStore {
  transactions: TransactionHistoryItem[];
}

// TODO
export class TransactionHistoryService {
  /**
   * @description notice, always set store.transactions by calling `_setStoreTransaction`
   */
  store!: TxHistoryStore;

  private _signingTxList: TransactionSigningItem[] = [];

  setStore = (
    recipe: (
      draft: TransactionHistoryItem[],
    ) => TransactionHistoryItem[] | void,
  ) => {
    this.store.transactions = produce(this.store.transactions, recipe);
  };

  getPendingTxsByNonce(address: string, chainId: number, nonce: number) {
    return this.getTransactionGroups({
      address,
      chainId,
      nonce,
    });
  }

  getTransactionGroups({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId?: number;
    nonce?: number;
  }) {
    const groups: TransactionGroup[] = [];

    this.store.transactions?.forEach(tx => {
      if (!isSameAddress(address, tx.address)) {
        return;
      }
      if (chainId != null && tx.chainId !== chainId) {
        return;
      }
      if (nonce != null && tx.nonce !== nonce) {
        return;
      }
      const group = groups.find(
        g =>
          g.address === tx.address &&
          g.nonce === tx.nonce &&
          g.chainId === tx.chainId,
      );
      if (group) {
        group.txs.push(tx);
      } else {
        groups.push(new TransactionGroup({ txs: [tx] }));
      }
    });
    return groups;
  }

  getNonceByChain(address: string, chainId: number) {
    const list = this.getTransactionGroups({
      address,
      chainId,
    });
    const maxNonceTx = maxBy(
      list.filter(item => {
        return !item.isSubmitFailed && !item.isWithdrawed;
      }),
      item => item.nonce,
    );

    const firstSigningTx = this._signingTxList.find(item => {
      return item.rawTx.chainId === chainId && !item.isSubmitted;
    });
    const processingTx = this._signingTxList.find(
      item => item.rawTx.chainId === chainId && item.isSubmitted,
    );

    if (!maxNonceTx) return null;

    const maxLocalNonce = maxNonceTx.nonce;
    const firstSigningNonce =
      parseInt(firstSigningTx?.rawTx.nonce ?? '0', 0) ?? 0;
    const processingNonce = parseInt(processingTx?.rawTx.nonce ?? '0', 0) ?? 0;

    const maxLocalOrProcessingNonce = Math.max(maxLocalNonce, processingNonce);

    if (maxLocalOrProcessingNonce < firstSigningNonce) {
      return firstSigningNonce;
    }

    return maxLocalOrProcessingNonce + 1;
  }

  async getList(
    address: string,
  ): Promise<{ pendings: TransactionGroup[]; completeds: TransactionGroup[] }> {
    const groups = this.getTransactionGroups({
      address,
    });

    return {
      pendings: sortBy(
        groups.filter(item => item.isPending),
        'createdAt',
      ),
      completeds: sortBy(
        groups.filter(item => !item.isPending),
        'createdAt',
      ),
    };
  }

  addTx(tx: TransactionHistoryItem) {
    this.setStore(draft => {
      draft.push(tx);
    });
  }

  addSigningTx(tx: Tx) {
    const id = nanoid();

    this._signingTxList.push({
      rawTx: tx,
      id,
    });

    return id;
  }

  getSigningTx(id: string) {
    return this._signingTxList.find(item => item.id === id);
  }

  removeSigningTx(id: string) {
    this._signingTxList = this._signingTxList.filter(item => item.id !== id);
  }

  removeAllSigningTx() {
    this._signingTxList = [];
  }

  updateSigningTx(
    id: string,
    data: {
      explain?: Partial<TransactionSigningItem['explain']>;
      rawTx?: Partial<TransactionSigningItem['rawTx']>;
      action?: {
        actionData: any;
        requiredData: any;
      };
      isSubmitted?: boolean;
    },
  ) {
    const target = this._signingTxList.find(item => item.id === id);
    if (target) {
      target.rawTx = {
        ...target.rawTx,
        ...data.rawTx,
      };
      target.explain = {
        ...target.explain,
        ...data.explain,
      } as TransactionSigningItem['explain'];
      if (data.action) {
        target.action = data.action;
      }
      target.isSubmitted = data.isSubmitted;
    }
  }

  constructor(options?: StorageAdapaterOptions) {
    this.store = createPersistStore<TxHistoryStore>(
      {
        name: 'txHistory',
        template: {
          transactions: [],
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    if (!Array.isArray(this.store.transactions)) {
      this.store.transactions = [];
    }

    // this._populateAvailableTxs();
  }

  updateTx(tx: TransactionHistoryItem) {
    this.setStore(draft => {
      const index = draft.findIndex(
        item => item.hash === tx.hash || item.reqId === tx.reqId,
      );
      if (index !== -1) {
        draft[index] = tx;
      }
    });
  }
}

export class TransactionGroup {
  txs: TransactionHistoryItem[];

  constructor({ txs }: { txs: TransactionHistoryItem[] }) {
    this.txs = txs;
  }

  get address() {
    return this.txs[0].address;
  }
  get nonce() {
    return this.txs[0].nonce;
  }
  get chainId() {
    return this.txs[0].chainId;
  }

  get maxGasTx() {
    return findMaxGasTx(this.txs);
  }

  get isPending() {
    return this.maxGasTx.isPending;
  }
  get isSubmitFailed() {
    return this.maxGasTx.isSubmitFailed;
  }

  get isWithdrawed() {
    return this.maxGasTx.isWithdrawed;
  }

  get createdAt() {
    return minBy(this.txs, 'createdAt')?.createdAt || 0;
  }
}
