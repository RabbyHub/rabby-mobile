import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import {
  ExplainTxResponse,
  Tx,
  TxPushType,
  TxRequest,
} from '@rabby-wallet/rabby-api/dist/types';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import { Object as ObjectType } from 'ts-toolbelt';
import { findMaxGasTx } from '../utils/tx';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { sortBy, minBy, maxBy } from 'lodash';
import { openapi, testOpenapi } from '../request';
import { CHAINS } from '@debank/common';
import { EVENTS, eventBus } from '@/utils/events';
import {
  ActionRequireData,
  ParsedActionData,
} from '@/components/Approval/components/Actions/utils';
import { DappInfo } from './dappService';

export interface TransactionHistoryItem {
  address: string;
  chainId: number;
  nonce: number;

  rawTx: Tx;
  createdAt: number;
  hash?: string;
  gasUsed?: number;
  // site?: ConnectedSite;
  site?: DappInfo;

  pushType?: TxPushType;
  reqId?: string;

  isPending?: boolean;
  isWithdrawed?: boolean;
  isFailed?: boolean;
  isSubmitFailed?: boolean;
  isCompleted?: boolean;

  explain?: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: ParsedActionData;
    requiredData: ActionRequireData;
  };
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

  getList(address: string): {
    pendings: TransactionGroup[];
    completeds: TransactionGroup[];
  } {
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
        draft[index] = { ...tx };
      }
    });
  }

  completeTx({
    address,
    chainId,
    nonce,
    hash,
    success = true,
    gasUsed,
    reqId,
  }: {
    address: string;
    chainId: number;
    nonce: number;
    hash?: string;
    reqId?: string;
    success?: boolean;
    gasUsed?: number;
  }) {
    const target = this.getTransactionGroups({
      address,
      chainId,
      nonce,
    })?.[0];
    if (!target.isPending) {
      return;
    }

    target.isPending = false;
    target.isFailed = !success;
    if (gasUsed) {
      target.maxGasTx.gasUsed = gasUsed;
    }

    this.updateTx(target.maxGasTx);

    // this._setStoreTransaction({
    //   ...this.store.transactions,
    //   [normalizedAddress]: {
    //     ...this.store.transactions[normalizedAddress],
    //     [key]: target,
    //   },
    // });
    const chain = Object.values(CHAINS).find(
      item => item.id === Number(target.chainId),
    );
    // if (chain) {
    //   stats.report('completeTransaction', {
    //     chainId: chain.serverId,
    //     success,
    //     preExecSuccess:
    //       target.explain.pre_exec.success && target.explain.calcSuccess,
    //     createBy: target?.$ctx?.ga ? 'rabby' : 'dapp',
    //     source: target?.$ctx?.ga?.source || '',
    //     trigger: target?.$ctx?.ga?.trigger || '',
    //   });
    // }
    // this.clearBefore({ address, chainId, nonce });
  }

  async reloadTx(
    {
      address,
      chainId,
      nonce,
    }: {
      address: string;
      chainId: number;
      nonce: number;
    },
    duration: number | boolean = 0,
  ) {
    const target = this.getTransactionGroups({
      address,
      chainId,
      nonce,
    })?.[0];
    if (!target) {
      return;
    }

    const chain = Object.values(CHAINS).find(c => c.id === chainId)!;
    const { txs } = target;

    const broadcastedTxs = txs.filter(
      tx => tx && tx.hash && !tx.isSubmitFailed && !tx.isWithdrawed,
    ) as (TransactionHistoryItem & { hash: string })[];

    try {
      const results = await Promise.all(
        broadcastedTxs.map(tx =>
          openapi.getTx(
            chain.serverId,
            tx.hash!,
            Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0),
          ),
        ),
      );
      const completed = results.find(
        result => result.code === 0 && result.status !== 0,
      );
      if (!completed) {
        if (
          duration !== false &&
          typeof duration === 'number' &&
          duration < 1000 * 15
        ) {
          // maximum retry 15 times;
          setTimeout(() => {
            this.reloadTx({ address, chainId, nonce });
          }, Number(duration) + 1000);
        }
        return;
      }
      const completedTx = txs.find(tx => tx.hash === completed.hash)!;
      this.updateTx({
        ...completedTx,
        gasUsed: completed.gas_used,
      });
      // TOFIX
      this.completeTx({
        address,
        chainId,
        nonce,
        hash: completedTx.hash,
        success: completed.status === 1,
        reqId: completedTx.reqId,
      });
      eventBus.emit(EVENTS.broadcastToUI, {
        method: EVENTS.RELOAD_TX,
        params: {
          addressList: [address],
        },
      });
    } catch (e) {
      if (
        duration !== false &&
        typeof duration === 'number' &&
        duration < 1000 * 15
      ) {
        // maximum retry 15 times;
        setTimeout(() => {
          this.reloadTx({ address, chainId, nonce });
        }, Number(duration) + 1000);
      }
    }
  }

  updateTxByTxRequest = (txRequest: TxRequest) => {
    const { chainId, from } = txRequest.signed_tx;
    const nonce = txRequest.nonce;

    const target = this.getTransactionGroups({
      address: from,
      chainId,
      nonce,
    })?.[0];
    if (!target) {
      return;
    }

    const tx = target.txs.find(
      item => item.reqId && item.reqId === txRequest.id,
    );

    if (!tx) {
      return;
    }

    const isSubmitFailed =
      txRequest.push_status === 'failed' && txRequest.is_finished;

    this.updateTx({
      ...tx,
      hash: txRequest.tx_id || undefined,
      isWithdrawed:
        txRequest.is_withdraw ||
        (txRequest.is_finished && !txRequest.tx_id && !txRequest.push_status),
      isSubmitFailed: isSubmitFailed,
    });
  };

  reloadTxRequest = async ({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId: number;
    nonce: number;
  }) => {
    const key = `${chainId}-${nonce}`;
    const from = address.toLowerCase();
    const target = this.store.transactions[from][key];
    const chain = Object.values(CHAINS).find(c => c.id === chainId)!;
    console.log('reloadTxRequest', target);
    if (!target) {
      return;
    }
    const { txs } = target;
    const unbroadcastedTxs = txs.filter(
      tx =>
        tx && tx.reqId && !tx.hash && !tx.isSubmitFailed && !tx.isWithdrawed,
    ) as (TransactionHistoryItem & { reqId: string })[];

    console.log('reloadTxRequest', unbroadcastedTxs);
    if (unbroadcastedTxs.length) {
      const service = chain?.isTestnet ? testOpenapi : openapi;
      await service
        .getTxRequests(unbroadcastedTxs.map(tx => tx.reqId))
        .then(res => {
          res.forEach((item, index) => {
            this.updateTxByTxRequest(item);

            eventBus.emit(EVENTS.broadcastToUI, {
              method: EVENTS.RELOAD_TX,
              params: {
                addressList: [address],
              },
            });
          });
        })
        .catch(e => console.error(e));
    }
  };
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

  get originTx() {
    return minBy(this.txs, 'createdAt');
  }

  get isPending() {
    return !!this.maxGasTx.isPending;
  }

  get isCompleted() {
    return !!this.maxGasTx.isCompleted;
  }

  set isPending(v: boolean) {
    this.maxGasTx.isPending = v;
  }
  get isSubmitFailed() {
    return !!this.maxGasTx.isSubmitFailed;
  }

  set isSubmitFailed(v: boolean) {
    this.maxGasTx.isSubmitFailed = v;
  }

  get isWithdrawed() {
    return !!this.maxGasTx.isWithdrawed;
  }

  set isWithdrawed(v: boolean) {
    this.maxGasTx.isWithdrawed = v;
  }

  get isFailed() {
    return !!this.maxGasTx.isFailed;
  }

  set isFailed(v: boolean) {
    this.maxGasTx.isFailed = v;
  }

  get createdAt() {
    return minBy(this.txs, 'createdAt')?.createdAt || 0;
  }
}
