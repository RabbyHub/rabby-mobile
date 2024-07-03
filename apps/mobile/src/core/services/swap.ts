import { DEX_ENUM } from '@rabby-wallet/rabby-swap';
import { CHAINS_ENUM } from '@debank/common';
import { GasCache, ChainGas } from './preference';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '../request';
import { CEX, DEX, SWAP_SUPPORT_CHAINS } from '@/constant/swap';

export type ViewKey = keyof typeof CEX | keyof typeof DEX;

export type SwapServiceStore = {
  gasPriceCache: GasCache;
  selectedDex: DEX_ENUM | null;
  selectedChain: CHAINS_ENUM | null;
  selectedFromToken?: TokenItem;
  selectedToToken?: TokenItem;
  unlimitedAllowance: boolean;
  viewList: Record<ViewKey, boolean>;
  tradeList: Record<ViewKey, boolean>;
  sortIncludeGasFee?: boolean;
  preferMEVGuarded: boolean;
};

export class SwapService {
  store: SwapServiceStore = {
    gasPriceCache: {},
    selectedChain: null,
    selectedFromToken: undefined,
    selectedToToken: undefined,
    selectedDex: null,
    unlimitedAllowance: false,
    viewList: {} as SwapServiceStore['viewList'],
    tradeList: {} as SwapServiceStore['tradeList'],
    sortIncludeGasFee: false,
    preferMEVGuarded: false,
  };
  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<SwapServiceStore>(
      {
        name: 'swap',
        template: {
          gasPriceCache: {},
          selectedChain: null,
          selectedDex: null,
          unlimitedAllowance: false,
          viewList: {} as SwapServiceStore['viewList'],
          tradeList: {} as SwapServiceStore['tradeList'],
          preferMEVGuarded: false,
          sortIncludeGasFee: true,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    if (storage) {
      const values = Object.values(DEX_ENUM);
      if (storage.selectedDex && !values.includes(storage.selectedDex)) {
        storage.selectedDex = null;
      }

      if (
        storage?.selectedChain &&
        !SWAP_SUPPORT_CHAINS.includes(storage?.selectedChain)
      ) {
        storage.selectedChain = null;
        storage.selectedFromToken = undefined;
        storage.selectedToToken = undefined;
      }
    }
    this.store = storage || this.store;

    this.handleUnsupportedChain();
  }

  handleUnsupportedChain = () => {
    if (
      this.store.selectedChain &&
      !SWAP_SUPPORT_CHAINS.includes(this.store.selectedChain)
    ) {
      this.store.selectedChain = null;
      this.store.selectedFromToken = undefined;
      this.store.selectedToToken = undefined;
    }
  };

  getSwap = (key?: keyof SwapServiceStore) => {
    return key ? this.store[key] : this.store;
  };

  getLastTimeGasSelection = (chainId: keyof GasCache): ChainGas | null => {
    const cache = this.store.gasPriceCache[chainId];
    if (cache && cache.lastTimeSelect === 'gasPrice') {
      if (Date.now() <= (cache.expireAt || 0)) {
        return cache;
      } else if (cache.gasLevel) {
        return {
          lastTimeSelect: 'gasLevel',
          gasLevel: cache.gasLevel,
        };
      } else {
        return null;
      }
    } else {
      return cache;
    }
  };

  updateLastTimeGasSelection = (chainId: keyof GasCache, gas: ChainGas) => {
    if (gas.lastTimeSelect === 'gasPrice') {
      this.store.gasPriceCache = {
        ...this.store.gasPriceCache,
        [chainId]: {
          ...this.store.gasPriceCache[chainId],
          ...gas,
          expireAt: Date.now() + 3600000, // custom gasPrice will expire at 1h later
        },
      };
    } else {
      this.store.gasPriceCache = {
        ...this.store.gasPriceCache,
        [chainId]: {
          ...this.store.gasPriceCache[chainId],
          ...gas,
        },
      };
    }
  };

  getSelectedDex = () => {
    return this.store.selectedDex;
  };

  setSelectedDex = (dexId: DEX_ENUM) => {
    this.store.selectedDex = dexId;
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

  getUnlimitedAllowance = () => {
    return this.store.unlimitedAllowance;
  };

  setUnlimitedAllowance = (bool: boolean) => {
    this.store.unlimitedAllowance = bool;
  };

  getSwapViewList = () => {
    return this.store.viewList;
  };

  setSwapView = (id: ViewKey, bool: boolean) => {
    if (!this.store.viewList) {
      this.store.viewList = {} as SwapServiceStore['viewList'];
    }
    this.store.viewList = {
      ...this.store.viewList,
      [id]: bool,
    };
  };

  getSwapTradeList = () => {
    return this.store.tradeList;
  };

  setSwapTrade = (dexId: ViewKey, bool: boolean) => {
    if (!this.store.tradeList) {
      this.store.tradeList = {} as SwapServiceStore['tradeList'];
    }
    this.store.tradeList = {
      ...this.store.tradeList,
      [dexId]: bool,
    };
  };

  getSwapSortIncludeGasFee = () => {
    return this.store.sortIncludeGasFee ?? true;
  };

  setSwapSortIncludeGasFee = (bool: boolean) => {
    this.store.sortIncludeGasFee = bool;
  };

  txQuotes: Record<
    string,
    Omit<Parameters<OpenApiService['postSwap']>[0], 'tx' | 'tx_id'>
  > = {};

  addTx = (
    chain: CHAINS_ENUM,
    data: string,
    quoteInfo: Omit<Parameters<OpenApiService['postSwap']>[0], 'tx' | 'tx_id'>,
  ) => {
    this.txQuotes[`${chain}-${data}`] = quoteInfo;
  };

  postSwap = (
    chain: CHAINS_ENUM,
    hash: string,
    tx: Parameters<OpenApiService['postSwap']>[0]['tx'],
  ) => {
    const { postSwap } = openapi;
    const { txQuotes } = this;
    const key = `${chain}-${tx.data}`;
    const quoteInfo = txQuotes[key];
    if (quoteInfo) {
      delete txQuotes[key];
      return postSwap({
        ...quoteInfo,
        tx,
        tx_id: hash,
      });
    }
  };

  getSwapPreferMEVGuarded = () => {
    return this.store.preferMEVGuarded ?? false;
  };

  setSwapPreferMEVGuarded = (bool: boolean) => {
    this.store.preferMEVGuarded = bool;
  };
}
