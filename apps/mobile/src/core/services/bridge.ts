import { CHAINS_ENUM } from '@debank/common';
import cloneDeep from 'lodash/cloneDeep';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { TokenItem, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '../request';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { getTxMatchData } from '@/utils/tempoTx';

export type BridgeRecord = {
  aggregator_id: string;
  bridge_id: string;
  from_chain_id: string;
  from_token_id: string;
  from_token_amount: string | number;
  to_chain_id: string;
  to_token_id: string;
  to_token_amount: string | number;
  tx: Partial<Tx>;
  rabby_fee: number;
  fee_rate: number;
  slippage: number;
  duration: number;
};

export type BridgeServiceStore = {
  selectedChain: CHAINS_ENUM | null;
  selectedFromToken?: TokenItem;
  selectedToToken?: TokenItem;
  selectedAggregators?: string[];
  txQuotes?: Record<string, BridgeRecord>;
  openBridgeHistoryTs: Record<string, number>;
};

export class BridgeService extends StoreServiceBase<
  BridgeServiceStore,
  APP_STORE_NAMES.bridge
> {
  constructor(options?: StorageAdapaterOptions) {
    super(
      APP_STORE_NAMES.bridge,
      {
        selectedChain: null,
        txQuotes: {},
        openBridgeHistoryTs: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }

  getBridgeData = (key?: keyof BridgeServiceStore) => {
    return cloneDeep(key ? this.store[key] : this.store);
  };

  getBridgeAggregators = () => {
    return this.getStoreFieldSnapshot('selectedAggregators');
  };

  setBridgeAggregators = (selectedAggregators: string[]) => {
    this.mutateStore(draft => {
      draft.selectedAggregators = [...selectedAggregators];
    });
  };

  getSelectedChain = () => {
    return this.store.selectedChain;
  };

  setSelectedChain = (chain: CHAINS_ENUM) => {
    this.mutateStore(draft => {
      draft.selectedChain = chain;
    });
  };

  getSelectedFromToken = () => {
    return this.getStoreFieldSnapshot('selectedFromToken');
  };
  getSelectedToToken = () => {
    return this.getStoreFieldSnapshot('selectedToToken');
  };

  setSelectedFromToken = (token?: TokenItem) => {
    this.mutateStore(draft => {
      draft.selectedFromToken = token;
    });
  };
  setSelectedToToken = (token?: TokenItem) => {
    this.mutateStore(draft => {
      draft.selectedToToken = token;
    });
  };

  getOpenBridgeHistoryTs = (address: string) => {
    return this.store.openBridgeHistoryTs[address] || 0;
  };

  setOpenBridgeHistoryTs = (address: string) => {
    this.mutateStore(draft => {
      draft.openBridgeHistoryTs[address] = Date.now();
    });
  };

  txQuotes: Record<string, BridgeRecord> = {};

  addTx = (chain: CHAINS_ENUM, data: string, info: BridgeRecord) => {
    this.txQuotes[`${chain}-${data}`] = info;
  };

  postBridge = (chain: CHAINS_ENUM, hash: string, tx: Tx) => {
    const { postBridgeHistory } = openapi;
    const key = `${chain}-${getTxMatchData(tx as any)}`;
    const data = { ...this.txQuotes };
    const quoteInfo = data[key];
    if (quoteInfo) {
      delete data[key];
      this.txQuotes = data;
      return postBridgeHistory({
        ...quoteInfo,
        tx,
        tx_id: hash,
      });
    }
  };
}
