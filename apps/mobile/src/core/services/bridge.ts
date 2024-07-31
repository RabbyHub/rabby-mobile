import { CHAINS_ENUM } from '@debank/common';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { TokenItem, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '../request';

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
};

export type BridgeServiceStore = {
  selectedChain: CHAINS_ENUM | null;
  selectedFromToken?: TokenItem;
  selectedToToken?: TokenItem;
  selectedAggregators?: string[];
  txQuotes?: Record<string, BridgeRecord>;
};

export class BridgeService {
  store: BridgeServiceStore = {
    selectedChain: null,
    selectedFromToken: undefined,
    selectedToToken: undefined,
    selectedAggregators: undefined,
  };

  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<BridgeServiceStore>(
      {
        name: 'bridge',
        template: {
          selectedChain: null,
          txQuotes: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );

    this.store = storage || this.store;
  }

  getBridgeData = (key?: keyof BridgeServiceStore) => {
    return key ? this.store[key] : { ...this.store };
  };

  getBridgeAggregators = () => {
    return this.store.selectedAggregators;
  };

  setBridgeAggregators = (selectedAggregators: string[]) => {
    this.store.selectedAggregators = [...selectedAggregators];
  };

  getSelectedChain = () => {
    return this.store.selectedChain;
  };

  setSelectedChain = (chain: CHAINS_ENUM) => {
    this.store.selectedChain = chain;
  };

  getSelectedFromToken = () => {
    return this.store.selectedFromToken;
  };
  getSelectedToToken = () => {
    return this.store.selectedToToken;
  };

  setSelectedFromToken = (token?: TokenItem) => {
    this.store.selectedFromToken = token;
  };
  setSelectedToToken = (token?: TokenItem) => {
    this.store.selectedToToken = token;
  };

  txQuotes: Record<string, BridgeRecord> = {};

  addTx = (chain: CHAINS_ENUM, data: string, info: BridgeRecord) => {
    this.txQuotes[`${chain}-${data}`] = info;
  };

  postBridge = (chain: CHAINS_ENUM, hash: string, tx: Tx) => {
    const { postBridgeHistory } = openapi;
    const key = `${chain}-${tx.data}`;
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
