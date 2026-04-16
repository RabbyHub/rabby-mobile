import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import {
  BridgeHistory,
  ExplainTxResponse,
  TokenItem,
  Tx,
  TxAllHistoryResult,
  TxPushType,
  TxRequest,
} from '@rabby-wallet/rabby-api/dist/types';
import { nanoid } from 'nanoid';
import { Object as ObjectType } from 'ts-toolbelt';
import { findMaxGasTx, getRpcTxReceipt } from '../utils/tx';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { sortBy, minBy, maxBy, uniqBy, flatten } from 'lodash';
import { openapi, testOpenapi } from '../request';
import { EVENTS, eventBus } from '@/utils/events';
import {
  ActionRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { DappInfo } from './dappService';
import { stats } from '@/utils/stats';
import { findChain } from '@/utils/chain';
import { customTestnetService } from './customTestnetService';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
// import { updateExpiredTime } from '@/databases/sync/assets'
import { customTestnetTokenToTokenItem, getTokenSymbol } from '@/utils/token';
import {
  loadTxSaveFromLocalStore,
  txDonePatchTokenAmountInDb,
} from '@/screens/Transaction/components/utils';
import { REPORT_TIMEOUT_ACTION_KEY } from './type';
import { updateExpiredTime } from '@/databases/sync/utils';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';

export interface TransactionHistoryItem {
  address: string;
  chainId: number;
  nonce: number;

  rawTx: Tx;
  createdAt: number;
  completedAt?: number;
  hash?: string;

  gasTokenSymbol?: string;
  gasUSDValue?: number;
  gasTokenCount?: number;

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

  isSynced?: boolean;

  explain?: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: ParsedActionData;
    requiredData: ActionRequireData;
  };

  $ctx?: any;
  keyringType?: KeyringTypeName;
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

export interface BridgeTxHistoryItem {
  address: string;
  fromChainId: number;
  toChainId: number;
  fromToken: TokenItem;
  toToken: TokenItem;
  slippage: number;
  fromAmount: number;
  toAmount: number;
  dexId: string;
  status: 'pending' | 'fromSuccess' | 'fromFailed' | 'allSuccess' | 'failed';
  acceleratedHash?: string;
  hash: string;
  estimatedDuration: number; // ms from server
  createdAt: number;
  fromTxCompleteTs?: number;
  completedAt?: number;
  actualToToken?: TokenItem; // actual token, may be not toToken
  actualToAmount?: number; // actual amount
}

export interface SwapTxHistoryItem {
  address: string;
  chainId: number;
  fromToken: TokenItem;
  toToken: TokenItem;
  slippage: number;
  fromAmount: number;
  toAmount: number;
  dexId: string;
  status: 'pending' | 'success' | 'failed';
  hash: string;
  createdAt: number;
  completedAt?: number;
  isFromCopyTrading?: boolean;
  copyTradingExtra?: {
    type: 'Buy' | 'Sell';
  };
}

export interface SendTxHistoryItem {
  address: string;
  chainId: number;
  from: string;
  to: string;
  token: TokenItem;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  hash: string;
  createdAt: number;
  completedAt?: number;
}

export interface ApproveTokenTxHistoryItem {
  address: string;
  chainId: number;
  amount: number;
  token: TokenItem;
  status: 'pending' | 'success' | 'failed';
  hash: string;
  createdAt: number;
  completedAt?: number;
}

export interface CustomTxItem {
  actionType: CUSTOM_HISTORY_TITLE_TYPE;
  customData?: any;
}

interface TxHistoryStore {
  transactions: TransactionHistoryItem[];
  swapTxHistory: SwapTxHistoryItem[];
  sendTxHistory: SendTxHistoryItem[];
  bridgeTxHistory: BridgeTxHistoryItem[];
  approveSwapTxHistory: ApproveTokenTxHistoryItem[];
  approveBridgeTxHistory: ApproveTokenTxHistoryItem[];
  successList: string[];
  failList: string[];
  isNeedFetchTxHistory: Record<string, boolean>;
  clearSuccessAndFailListTs: number;
  clearSuccessAndFailListTsObj: Record<string, number>;
  lendingSuccessHistoryList: string[];
  customTxItemsMap: Record<string, CustomTxItem>; // key is address-chain-txId
}

// TODO
export class TransactionHistoryService {
  /**
   * @description notice, always set store.transactions by calling `_setStoreTransaction`
   */
  store!: TxHistoryStore;
  preferenceService?: import('./preference').PreferenceService;

  private _signingTxList: TransactionSigningItem[] = [];
  private _txHistoryLimit = 500;

  constructor(
    options?: StorageAdapaterOptions & {
      preferenceService: import('./preference').PreferenceService;
    },
  ) {
    this.preferenceService = options?.preferenceService;
    this.store = createPersistStore<TxHistoryStore>(
      {
        name: APP_STORE_NAMES.txHistory,
        template: {
          transactions: [],
          swapTxHistory: [],
          bridgeTxHistory: [],
          approveSwapTxHistory: [],
          approveBridgeTxHistory: [],
          successList: [],
          failList: [],
          isNeedFetchTxHistory: {},
          clearSuccessAndFailListTs: new Date().getTime(),
          clearSuccessAndFailListTsObj: {},
          lendingSuccessHistoryList: [],
          customTxItemsMap: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    if (!Array.isArray(this.store.transactions)) {
      this.store.transactions = [];
    }

    if (!Array.isArray(this.store.successList)) {
      this.store.successList = [];
    }

    if (!Array.isArray(this.store.failList)) {
      this.store.failList = [];
    }

    if (!Array.isArray(this.store.swapTxHistory)) {
      this.store.swapTxHistory = [];
    }

    if (!Array.isArray(this.store.sendTxHistory)) {
      this.store.sendTxHistory = [];
    }

    if (!Array.isArray(this.store.bridgeTxHistory)) {
      this.store.bridgeTxHistory = [];
    }

    if (!Array.isArray(this.store.approveSwapTxHistory)) {
      this.store.approveSwapTxHistory = [];
    }

    if (!Array.isArray(this.store.approveBridgeTxHistory)) {
      this.store.approveBridgeTxHistory = [];
    }

    if (typeof this.store.isNeedFetchTxHistory !== 'object') {
      this.store.isNeedFetchTxHistory = {};
    }

    if (typeof this.store.clearSuccessAndFailListTs !== 'number') {
      this.store.clearSuccessAndFailListTs = new Date().getTime();
    }

    if (typeof this.store.clearSuccessAndFailListTsObj !== 'object') {
      this.store.clearSuccessAndFailListTsObj = {};
    }

    if (!Array.isArray(this.store.lendingSuccessHistoryList)) {
      this.store.lendingSuccessHistoryList = [];
    }

    if (typeof this.store.customTxItemsMap !== 'object') {
      this.store.customTxItemsMap = {};
    }

    this.init();

    // this._populateAvailableTxs();
  }

  init() {
    this.setStore(draft => {
      return uniqBy(draft, item => {
        return `${item.address}_${item.nonce}_${item.chainId}_${item.hash}_${item.reqId}`;
      });
    });
  }

  setStore = (
    recipe: (draft: TransactionHistoryItem[]) => TransactionHistoryItem[],
  ) => {
    this.store.transactions = recipe(this.store.transactions || []);
  };

  getPendingCount(address: string) {
    return this.getTransactionGroups({
      address,
    }).filter(item => item.isPending).length;
  }

  getPendingTxsByNonce(address: string, chainId: number, nonce: number) {
    return this.getTransactionGroups({
      address,
      chainId,
      nonce,
    });
  }

  getStore() {
    return this.store.approveSwapTxHistory;
  }

  getLendingSuccessHistoryList(address: string) {
    const list = this.store.lendingSuccessHistoryList.filter(item => {
      return item.startsWith(address.toLowerCase());
    });
    return list;
  }

  setLendingSuccessHistoryList(address: string, id: string) {
    if (
      !this.store.lendingSuccessHistoryList.includes(
        `${address.toLowerCase()}-${id}`,
      )
    ) {
      this.store.lendingSuccessHistoryList.push(
        `${address.toLowerCase()}-${id}`,
      );
    }
  }

  clearLendingSuccessHistoryList(address: string) {
    this.store.lendingSuccessHistoryList =
      this.store.lendingSuccessHistoryList.filter(item => {
        return !item.startsWith(address.toLowerCase());
      });
  }

  getSucceedCount(address?: string) {
    return this.store.successList.filter(item =>
      address ? item.startsWith(address) : true,
    ).length;
  }
  getSucceedList() {
    return this.store.successList;
  }

  setSucceedList(id: string) {
    if (!this.store.successList.includes(id)) {
      this.store.successList.push(id);
    }
  }

  setFailedList(id: string) {
    if (!this.store.failList.includes(id)) {
      this.store.failList.push(id);
    }
  }

  getFailedCount(address?: string) {
    return this.store.failList.filter(item =>
      address ? item.startsWith(address) : true,
    ).length;
  }

  getCustomTxItemMap() {
    return this.store.customTxItemsMap;
  }

  setCustomTxItem(
    address: string,
    chainId: number,
    txId: string,
    item: CustomTxItem,
  ) {
    const serverId = findChain({ id: chainId })?.serverId;
    this.store.customTxItemsMap = {
      ...this.store.customTxItemsMap,
      [`${address.toLowerCase()}-${serverId}-${txId}`]: item,
    };
  }

  getClearSuccessAndFailListTs() {
    return this.store.clearSuccessAndFailListTs;
  }

  getClearSuccessAndFailListTsObj() {
    return this.store.clearSuccessAndFailListTsObj;
  }

  setNeedFetchTxHistory(address: string) {
    if (!this.store.isNeedFetchTxHistory[address]) {
      setTimeout(() => {
        this.store.isNeedFetchTxHistory[address] = true;
      }, 5000);
    }
  }

  addApproveSwapTokenTxHistory(tx: ApproveTokenTxHistoryItem) {
    this.store.approveSwapTxHistory = [...this.store.approveSwapTxHistory, tx]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
  }

  addApproveBridgeTokenTxHistory(tx: ApproveTokenTxHistoryItem) {
    this.store.approveBridgeTxHistory = [
      ...this.store.approveBridgeTxHistory,
      tx,
    ]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
  }

  addSwapTxHistory(tx: SwapTxHistoryItem) {
    this.store.swapTxHistory.push(tx);
    this.store.swapTxHistory = this.store.swapTxHistory
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
  }

  addSendTxHistory(tx: SendTxHistoryItem) {
    this.store.sendTxHistory.push(tx);
    this.store.sendTxHistory = this.store.sendTxHistory
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 500); // need use to show send history list
  }

  addBridgeTxHistory(tx: BridgeTxHistoryItem) {
    this.store.bridgeTxHistory.push(tx);
    this.store.bridgeTxHistory = this.store.bridgeTxHistory
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200);
  }

  getRecentPendingTxHistory(
    address: string,
    type: 'swap' | 'send' | 'bridge' | 'approveSwap' | 'approveBridge',
  ) {
    const recentItem = this.store[`${type}TxHistory`]
      .filter(item => {
        return isSameAddress(address, item.address);
      })
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (
      recentItem?.status === 'pending' ||
      recentItem?.status === 'fromSuccess'
    ) {
      return recentItem;
    } else {
      return null;
    }
  }

  getRecentTxHistory(
    address: string,
    hash: string,
    chainId: number,
    type: 'swap' | 'send' | 'approveSwap' | 'approveBridge' | 'bridge',
  ) {
    return this.store[`${type}TxHistory`].find(
      item =>
        isSameAddress(address, item.address) &&
        item.hash === hash &&
        ('chainId' in item ? item.chainId : item.fromChainId) === chainId,
    );
  }

  completeRecentTxHistory(
    txs: TransactionHistoryItem[],
    chainId: number,
    status: SwapTxHistoryItem['status'],
    completedTx: TransactionHistoryItem,
  ) {
    const arr = [
      this.store.swapTxHistory,
      this.store.sendTxHistory,
      this.store.bridgeTxHistory,
      this.store.approveSwapTxHistory,
      this.store.approveBridgeTxHistory,
    ];

    const hashArr = txs.map(item => item.hash);

    eventBus.emit(EVENTS.INNER_HISTORY_ITEM_COMPLETE, {
      hashArr,
      chainId,
    });

    arr.forEach(async history => {
      const index = history.findIndex(
        (
          item:
            | SwapTxHistoryItem
            | SendTxHistoryItem
            | BridgeTxHistoryItem
            | ApproveTokenTxHistoryItem,
        ) =>
          ('fromChainId' in item ? item.fromChainId : item.chainId) ===
            chainId && hashArr.includes(item.hash),
      );
      if (index > -1) {
        if ('fromChainId' in history[index]) {
          const completedHash = completedTx.hash;
          // bridge tx
          history[index].status =
            status === 'success' ? 'fromSuccess' : 'fromFailed';
          (history[index] as BridgeTxHistoryItem).fromTxCompleteTs = Date.now();
          (history[index] as BridgeTxHistoryItem).acceleratedHash =
            completedHash || history[index].hash;
        } else {
          history[index].status = status;
          history[index].completedAt = Date.now();
        }
        if (
          'isFromCopyTrading' in history[index] &&
          history[index].isFromCopyTrading
        ) {
          const isSell = history[index].copyTradingExtra?.type === 'Sell';
          if (!isSell) {
            // only buy insert buy item
            // insertCopyTradingBuyItem(history[index]);
          }
          matomoRequestEvent({
            category: 'CopyTrading',
            action: isSell
              ? 'CopyTrading_SellFinishSwap'
              : 'CopyTrading_BuyFinishSwap',
          });
        }
      }
    });
  }

  completeBridgeTxHistory(
    from_tx_id: string,
    chainId: number,
    status: BridgeTxHistoryItem['status'],
    bridgeTx?: BridgeHistory,
  ) {
    let changed = false;
    this.store.bridgeTxHistory.forEach((item, index) => {
      if (item.fromChainId === chainId && item.hash === from_tx_id) {
        changed = true;
        this.store.bridgeTxHistory[index].status = status;
        this.store.bridgeTxHistory[index].completedAt = Date.now();
        this.store.bridgeTxHistory[index].actualToToken =
          bridgeTx?.to_actual_token;
        this.store.bridgeTxHistory[index].actualToAmount =
          bridgeTx?.actual?.receive_token_amount;
      }
    });
    if (changed) {
      this.store.bridgeTxHistory = this.store.bridgeTxHistory;
    }
  }

  getIsNeedFetchTxHistory(address: string) {
    const res = this.store.isNeedFetchTxHistory[address];
    res && (this.store.isNeedFetchTxHistory[address] = false);
    return res;
  }

  clearSuccessAndFailList(address?: string) {
    if (address) {
      this.store.successList = this.store.successList.filter(
        item => !item.startsWith(address),
      );
      this.store.failList = this.store.failList.filter(
        item => !item.startsWith(address),
      );
      this.store.clearSuccessAndFailListTsObj = {
        ...this.store.clearSuccessAndFailListTsObj,
        [address.toLowerCase()]: Date.now(),
      };
      return;
    } else {
      this.store.successList = [];
      this.store.failList = [];
      this.store.clearSuccessAndFailListTs = new Date().getTime();
      Object.keys(this.store.clearSuccessAndFailListTsObj).map(
        key => (this.store.clearSuccessAndFailListTsObj[key] = Date.now()),
      );
    }
  }

  clearSuccessAndFailSingleId(id: string) {
    const successIdx = this.store.successList.findIndex(item => item === id);
    if (successIdx !== -1) {
      this.store.successList.splice(successIdx, 1);
      return true;
    }

    const failIdx = this.store.failList.findIndex(item => item === id);
    if (failIdx !== -1) {
      this.store.failList.splice(failIdx, 1);
    }
  }

  getTransactionGroups(args?: {
    address?: string;
    chainId?: number;
    nonce?: number;
  }) {
    const { address, chainId, nonce } = args || {};
    const groups: TransactionGroup[] = [];

    this.store.transactions?.forEach(tx => {
      if (address != null && !isSameAddress(address, tx.address)) {
        return;
      }
      if (chainId != null && tx.chainId !== chainId) {
        return;
      }
      if (nonce != null && tx.nonce !== nonce) {
        return;
      }
      if (
        !findChain({
          id: tx.chainId,
        })
      ) {
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

  getSwapFailTransactions(address: string) {
    const groups = this.getTransactionGroups({
      address,
    });

    const failedGroups = groups.filter(item => {
      const swapAction =
        item.maxGasTx.action?.actionData.swap ||
        item.maxGasTx.action?.actionData.wrapToken ||
        item.maxGasTx.action?.actionData.unWrapToken;

      const isFailed =
        item.isFailed || item.isSubmitFailed || item.isWithdrawed;

      return isFailed && swapAction;
    });

    return failedGroups;
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
      return (
        item.rawTx.chainId === chainId &&
        !item.isSubmitted &&
        isSameAddress(item.rawTx.from, address)
      );
    });
    const processingTx = this._signingTxList.find(
      item =>
        item.rawTx.chainId === chainId &&
        item.isSubmitted &&
        isSameAddress(item.rawTx.from, address),
    );

    if (!maxNonceTx) {
      return null;
    }

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
    const completeds = sortBy(
      groups.filter(item => !item.isPending),
      item => -item.createdAt,
    );
    const maxCompletedNonceByChain = completeds.reduce((res, item) => {
      res[item.chainId] = Math.max(res[item.chainId] ?? -1, item.nonce);
      return res;
    }, {} as Record<string, number>);

    return {
      pendings: sortBy(
        groups.filter(
          item =>
            item.isPending &&
            item.nonce > (maxCompletedNonceByChain[item.chainId] ?? -1),
        ),
        item => {
          return -item.createdAt;
        },
      ),
      completeds,
    };
  }

  getPendingsAddresses(addresses: string[]): {
    pendings: TransactionGroup[];
    pendingsLength: number;
  } {
    let pendings: TransactionGroup[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i].toLowerCase();
      const groups = this.getTransactionGroups({
        address: addr,
      });

      pendings = pendings.concat(groups.filter(item => item.isPending));
    }
    return {
      pendings,
      pendingsLength: pendings.length,
    };
  }

  addTx(tx: TransactionHistoryItem) {
    if (
      this.store.transactions.find(
        item =>
          isSameAddress(item.address, tx.address) &&
          item.chainId === tx.chainId &&
          item.nonce === tx.nonce &&
          ((item.hash && item.hash === tx.hash) ||
            (item.reqId && item.reqId === tx.reqId)),
      )
    ) {
      return;
    }
    this.setStore(draft => {
      return [...draft, tx];
    });
    this.clearAllExpiredTxs();
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

  updateTx(tx: TransactionHistoryItem) {
    this.setStore(draft => {
      const index = draft.findIndex(
        item =>
          item.chainId === tx.chainId &&
          ((item.hash && item.hash === tx.hash) ||
            (item.reqId && item.reqId === tx.reqId)),
      );
      if (index !== -1) {
        draft[index] = { ...tx };
      }
      return [...draft];
    });
  }

  removeList(address: string) {
    this.setStore(draft => {
      return draft.filter(item => {
        return !isSameAddress(item.address, address);
      });
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

    if (success) {
      updateExpiredTime(address.toLowerCase());
    }
    const chain = findChain({
      id: Number(target.chainId),
    });
    target?.txs?.forEach(tx => {
      if ((tx.hash && tx.hash === hash) || (tx.reqId && tx.reqId === reqId)) {
        const nativeToken =
          tx.explain?.native_token ||
          (chain
            ? customTestnetTokenToTokenItem({
                id: chain.nativeTokenAddress,
                chainId: chain.id,
                symbol: chain.nativeTokenSymbol,
                decimals: chain.nativeTokenDecimals,
                amount: 0,
                rawAmount: '0',
              })
            : undefined);

        const hasTokenPrice = !!nativeToken;
        const gasTokenCount =
          hasTokenPrice && tx
            ? (Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0) *
                (gasUsed || 0)) /
              1e18
            : 0;
        const gasUSDValue =
          gasTokenCount && nativeToken
            ? (nativeToken?.price || 0) * gasTokenCount
            : 0;
        const gasTokenSymbol =
          hasTokenPrice && nativeToken ? getTokenSymbol(nativeToken) : '';

        const newTx = {
          ...tx,
          isPending: false,
          isFailed: !success,
          isCompleted: true,
          gasUsed,
          gasTokenSymbol,
          gasUSDValue,
          gasTokenCount,
          completedAt: Date.now(),
        };
        this.updateTx(newTx);
        const id = tx.hash || tx.reqId;
        if (!success) {
          id && this.store.failList.push(`${address.toLowerCase()}-${id}`);
        }
        if (
          target?.customActionInfo?.customAction ===
            CUSTOM_HISTORY_ACTION.LENDING &&
          id &&
          success
        ) {
          this.setLendingSuccessHistoryList(address, id);
        }
        loadTxSaveFromLocalStore(newTx); // send type tx save local db
        this.setNeedFetchTxHistory(address.toLowerCase());
        txDonePatchTokenAmountInDb(newTx);
      }
    });

    if (chain) {
      // TODO $ctx
      stats.report('completeTransaction', {
        chainId: chain.serverId,
        success,
        preExecSuccess: chain.isTestnet
          ? true
          : target.maxGasTx.explain
          ? Boolean(
              target.maxGasTx?.explain?.pre_exec?.success &&
                target.maxGasTx?.explain?.calcSuccess,
            )
          : true,
        source: target?.$ctx?.ga?.source || '',
        trigger: target?.$ctx?.ga?.trigger || '',
        networkType: chain?.isTestnet ? 'Custom Network' : 'Integrated Network',
      });

      target?.$ctx?.ga?.category === 'Swap' &&
        this.preferenceService?.setReportActionTs(
          REPORT_TIMEOUT_ACTION_KEY.SWAP_ACTION_HAVE_DONE,
          {
            chain: chain.serverId,
          },
        );
    }
    this.clearBefore({ address, chainId, nonce });
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
    if (!target || target.isCompleted) {
      return;
    }

    const chain = findChain({
      id: chainId,
    })!;
    const { txs } = target;

    const broadcastedTxs = txs.filter(
      tx => tx && tx.hash && !tx.isSubmitFailed && !tx.isWithdrawed,
    ) as (TransactionHistoryItem & { hash: string })[];

    try {
      const results = await Promise.all(
        broadcastedTxs.map(tx => {
          if (chain.isTestnet) {
            return customTestnetService.getTx({
              chainId: chain.id,
              hash: tx.hash!,
            });
          } else {
            // Use standard RPC to get transaction receipt
            return getRpcTxReceipt(chain.serverId, tx.hash!);
          }
        }),
      );
      const completed = results.find(result => result.code === 0);
      if (!completed) {
        if (
          duration !== false &&
          typeof duration === 'number' &&
          duration < 1000 * 15
        ) {
          // maximum retry 15 times;
          setTimeout(() => {
            this.reloadTx({ address, chainId, nonce }, false);
          }, Number(duration) + 1000);
        }
        return;
      }
      const completedTx = txs.find(tx => tx.hash === completed.hash)!;

      this.completeTx({
        address,
        chainId,
        nonce,
        hash: completedTx.hash,
        success: completed.status === 1,
        reqId: completedTx.reqId,
        gasUsed: completed.gas_used,
      });
      this.completeRecentTxHistory(
        txs,
        chainId,
        completed.status === 1 ? 'success' : 'failed',
        completedTx,
      );
      eventBus.emit(EVENTS.RELOAD_TX, {
        addressList: [address],
      });
      return completed.gas_used;
    } catch (e) {
      if (
        duration !== false &&
        typeof duration === 'number' &&
        duration < 1000 * 15
      ) {
        // maximum retry 15 times;
        setTimeout(() => {
          this.reloadTx({ address, chainId, nonce }, false);
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
    const chain = findChain({
      id: chainId,
    })!;
    if (!target) {
      return;
    }
    const { txs } = target;
    const unbroadcastedTxs = txs.filter(
      tx =>
        tx && tx.reqId && !tx.hash && !tx.isSubmitFailed && !tx.isWithdrawed,
    ) as (TransactionHistoryItem & { reqId: string })[];

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
  /**
   * @description clear expired txs, keep this.txHistoryLimit 500 completed transactions
   */
  clearAllExpiredTxs() {
    const groups = this.getTransactionGroups();
    const pendingTxGroups: TransactionGroup[] = [];
    const completedTxGroups: TransactionGroup[] = [];
    groups.forEach(item => {
      if (item.isPending) {
        pendingTxGroups.push(item);
      } else {
        completedTxGroups.push(item);
      }
    });

    const list = sortBy(completedTxGroups, item => -item.createdAt);
    if (list.length <= this._txHistoryLimit) {
      return;
    }
    this.setStore(_ => {
      return [
        ...flatten(pendingTxGroups.map(item => item.txs)),
        ...flatten(list.slice(0, this._txHistoryLimit).map(item => item.txs)),
      ];
    });
  }

  clearBefore({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId: number;
    nonce: number;
  }) {
    this.setStore(draft => {
      const result = draft.filter(item => {
        const needClear =
          isSameAddress(address, item.address) &&
          item.chainId === chainId &&
          item.nonce < nonce &&
          item.isPending;
        if (needClear) {
          this.removeFeatPendingByLocal(item);
        }
        return !needClear;
      });
      if (result.length !== draft.length) {
        return result;
      }
      return draft;
    });
  }

  clearPendingTransactions(address: string) {
    this.setStore(draft => {
      return draft.filter(item => {
        if (!isSameAddress(address, item.address)) {
          return true;
        }
        return !item.isPending;
      });
    });
    this.store.swapTxHistory = this.store.swapTxHistory.filter(item => {
      return !(
        isSameAddress(address, item.address) && item.status === 'pending'
      );
    });
    this.store.sendTxHistory = this.store.sendTxHistory.filter(item => {
      return !(
        isSameAddress(address, item.address) && item.status === 'pending'
      );
    });
    this.store.bridgeTxHistory = this.store.bridgeTxHistory.filter(item => {
      return !(
        isSameAddress(address, item.address) && item.status !== 'allSuccess'
      );
    });
  }

  removeFeatPendingByLocal(localItem: TransactionHistoryItem) {
    this.store.swapTxHistory = this.store.swapTxHistory.filter(
      tx =>
        !(
          isSameAddress(localItem.address, tx.address) &&
          tx.status === 'pending' &&
          localItem.chainId === tx.chainId &&
          localItem?.hash === tx.hash
        ),
    );
    this.store.sendTxHistory = this.store.sendTxHistory.filter(
      tx =>
        !(
          isSameAddress(localItem.address, tx.address) &&
          tx.status === 'pending' &&
          localItem.chainId === tx.chainId &&
          localItem?.hash === tx.hash
        ),
    );
    this.store.bridgeTxHistory = this.store.bridgeTxHistory.filter(
      tx =>
        !(
          isSameAddress(localItem.address, tx.address) &&
          tx.status !== 'allSuccess' &&
          localItem.chainId === tx.fromChainId &&
          localItem?.hash === tx.hash
        ),
    );
  }

  removeLocalPendingTx({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId?: number;
    nonce?: number;
  }) {
    const groups = this.getTransactionGroups({
      address,
      chainId,
      nonce,
    }).filter(item => item.isPending);
    if (!groups.length) {
      return;
    }
    groups.forEach(
      item => item.originTx && this.removeFeatPendingByLocal(item.originTx),
    );
    this.setStore(draft => {
      return draft.filter(item => {
        return !groups.find(txGroup => {
          return (
            isSameAddress(txGroup.address, item.address) &&
            txGroup.nonce === item.nonce &&
            txGroup.chainId === item.chainId
          );
        });
      });
    });
  }
}

export class TransactionGroup {
  txs: TransactionHistoryItem[];

  constructor({ txs }: { txs: TransactionHistoryItem[] }) {
    this.txs = txs;
  }

  get $ctx() {
    return this.maxGasTx.$ctx || this.txs[0].$ctx;
  }

  get action() {
    return this.txs[0].action;
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

  get isSynced() {
    return !!this.maxGasTx.isSynced;
  }

  set isSynced(v: boolean) {
    this.maxGasTx.isSynced = v;
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

  get completedAt() {
    return this.maxGasTx.completedAt;
  }

  get keyringType() {
    return this.maxGasTx.keyringType;
  }

  get customActionInfo() {
    const isApproveDelegation =
      this.maxGasTx?.explain?.type_call?.action === 'approveDelegation';
    const approveData =
      this.maxGasTx.action?.actionData.approveToken ||
      this.maxGasTx.action?.actionData.approveNFT ||
      this.maxGasTx.action?.actionData.approveNFTCollection;

    if (approveData || isApproveDelegation) {
      // magic method to filter approve txs before action tx
      return {
        customAction: undefined,
        customActionTitleType: undefined,
      };
    }

    const ga = this.maxGasTx.$ctx?.ga;
    return {
      customAction: ga?.customAction as CUSTOM_HISTORY_ACTION | undefined,
      customActionTitleType: ga?.customActionTitleType as
        | CUSTOM_HISTORY_TITLE_TYPE
        | undefined,
    };
  }
}
