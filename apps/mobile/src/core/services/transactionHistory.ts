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

export interface TransactionHistoryItem {
  rawTx: Tx;
  createdAt: number;
  isCompleted: boolean;
  hash?: string;
  failed: boolean;
  gasUsed?: number;
  isSubmitFailed?: boolean;
  // site?: ConnectedSite;
  site?: any;

  pushType?: TxPushType;
  reqId?: string;
  isWithdrawed?: boolean;
  explain?: TransactionGroup['explain'];
  action?: TransactionGroup['action'];
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

export interface TransactionGroup {
  chainId: number;
  nonce: number;
  txs: TransactionHistoryItem[];
  isPending: boolean;
  createdAt: number;
  explain: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: any;
    requiredData: any;
    // actionData: ParsedActionData;
    // requiredData: ActionRequireData;
  };
  isFailed: boolean;
  isSubmitFailed?: boolean;
  $ctx?: any;
}

interface TxHistoryStore {
  transactions: {
    [addr: string]: Record<string, TransactionGroup>;
  };
}

// TODO
export class TransactionHistoryService {
  async getNonceByChain(from: string, chainId: number): Promise<string> {
    throw new Error('Method not implemented.');
  }
  async getList(
    address: string,
  ): Promise<{ pendings: any } | { pendings: any }> {
    throw new Error('Method not implemented.');
  }
  /**
   * @description notice, always set store.transactions by calling `_setStoreTransaction`
   */
  store!: TxHistoryStore;

  private _signingTxList: TransactionSigningItem[] = [];

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
          transactions: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    if (!this.store.transactions) this.store.transactions = {};

    // this._populateAvailableTxs();
  }
}
