import { Object as ObjectType } from 'ts-toolbelt';
import { nanoid } from 'nanoid';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import {
  ExplainTxResponse,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import { produce } from 'immer';
import { findMaxGasTx } from '../utils/tx';

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
    if (!this.store.transactions) {
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

  getTransactionGroups({
    address,
    chainId,
  }: {
    address: string;
    chainId: number;
  }) {
    const txs = this.store.transactions.filter(
      tx => tx.address === address && tx.chainId === chainId,
    );

    const groups: TransactionGroup[] = [];

    txs.forEach(tx => {
      const group = groups.find(
        g => g.nonce === tx.nonce && g.chainId === tx.chainId,
      );
      if (group) {
        group.txs.push(tx);
      } else {
        groups.push(new TransactionGroup({ txs: [tx] }));
      }
    });

    // todo sort by createdAt
    return groups;
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
}
