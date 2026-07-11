import { DEX_ENUM } from '@rabby-wallet/rabby-swap';
import { CHAINS_ENUM } from '@debank/common';
import type { GasCache, ChainGas } from '../startupServices/preference';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '../request';
import {
  CEX,
  DEX,
  getChainDefaultToken,
  SWAP_SUPPORT_CHAINS,
} from '@/constant/swap';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { getTxMatchData } from '@/utils/tempoTx';

export type ViewKey = keyof typeof CEX | keyof typeof DEX;

export type SwapServiceStore = {
  autoSlippage: boolean;
  isCustomSlippage?: boolean;
  slippage: string;
  selectedChain: CHAINS_ENUM | null;
  selectedFromToken?: TokenItem;
  selectedToToken?: TokenItem;
  preferMEVGuarded: boolean;
  recentToTokens?: TokenItem[];
  openSwapHistoryTs: Record<string, number>;

  /**
   * @deprecated
   */
  gasPriceCache: GasCache;
  /**
   * @deprecated
   */
  selectedDex: DEX_ENUM | null;
  /**
   * @deprecated
   */
  unlimitedAllowance: boolean;
  /**
   * @deprecated
   */
  viewList: Record<ViewKey, boolean>;
  /**
   * @deprecated
   */
  tradeList: Record<ViewKey, boolean>;
  /**
   * @deprecated
   */
  sortIncludeGasFee?: boolean;
  /**
   * @deprecated
   */
};

const getSelectedChainServerId = (chain: CHAINS_ENUM | null) => {
  if (!chain) {
    return undefined;
  }

  return findChainByEnum(chain)?.serverId;
};

const isTokenOnSelectedChain = (
  token: TokenItem | undefined,
  chain: CHAINS_ENUM | null,
) => {
  if (!token) {
    return true;
  }

  const chainServerId = getSelectedChainServerId(chain);
  return (
    !!chainServerId &&
    token.chain?.toLowerCase() === chainServerId.toLowerCase()
  );
};

const sanitizeSelectedTokens = (store: SwapServiceStore) => {
  if (!store.selectedChain) {
    store.selectedFromToken = undefined;
    store.selectedToToken = undefined;
    return;
  }

  if (!isTokenOnSelectedChain(store.selectedFromToken, store.selectedChain)) {
    store.selectedFromToken = undefined;
  }

  if (!isTokenOnSelectedChain(store.selectedToToken, store.selectedChain)) {
    store.selectedToToken = undefined;
  }
};

export class SwapService {
  store: SwapServiceStore = {
    autoSlippage: true,
    slippage: '0.1',
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
    openSwapHistoryTs: {},
    recentToTokens: [],
  };
  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<SwapServiceStore>(
      {
        name: APP_STORE_NAMES.swap,
        template: {
          autoSlippage: true,
          slippage: '0.1',
          gasPriceCache: {},
          selectedChain: null,
          selectedDex: null,
          unlimitedAllowance: false,
          viewList: {} as SwapServiceStore['viewList'],
          tradeList: {} as SwapServiceStore['tradeList'],
          preferMEVGuarded: false,
          sortIncludeGasFee: true,
          recentToTokens: [],
          openSwapHistoryTs: {},
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

      sanitizeSelectedTokens(storage);

      if (storage.recentToTokens?.length) {
        storage.recentToTokens = storage.recentToTokens.filter(item => {
          const chainEnum = findChainByServerID(item.chain)?.enum;
          if (chainEnum) {
            const chainDefaultToken = getChainDefaultToken(chainEnum);
            const isWrongToken =
              chainDefaultToken?.id !== item.id &&
              chainDefaultToken.symbol === item.symbol &&
              chainDefaultToken.name === item.name &&
              chainDefaultToken?.time_at === item.time_at;
            return !isWrongToken;
          }
          return false;
        });
      }

      if (typeof storage.openSwapHistoryTs !== 'object') {
        storage.openSwapHistoryTs = {};
      }
    }
    this.store = storage || this.store;
  }

  handleUnsupportedChain = () => {
    if (
      this.store.selectedChain &&
      !SWAP_SUPPORT_CHAINS.includes(this.store.selectedChain)
    ) {
      this.store.selectedChain = null;
      this.store.selectedFromToken = undefined;
      this.store.selectedToToken = undefined;
      return;
    }
    sanitizeSelectedTokens(this.store);
  };

  getSwap = <K extends keyof SwapServiceStore>(key?: K) => {
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
    this.handleUnsupportedChain();
    return this.store.selectedChain;
  };

  setSelectedChain = (chain: CHAINS_ENUM) => {
    this.store.selectedChain = chain;
    sanitizeSelectedTokens(this.store);
  };

  getSelectedFromToken = () => {
    sanitizeSelectedTokens(this.store);
    return this.store.selectedFromToken;
  };
  getSelectedToToken = () => {
    sanitizeSelectedTokens(this.store);
    return this.store.selectedToToken;
  };

  setSelectedFromToken = (token?: TokenItem) => {
    this.store.selectedFromToken = isTokenOnSelectedChain(
      token,
      this.store.selectedChain,
    )
      ? token
      : undefined;
  };
  setSelectedToToken = (token?: TokenItem) => {
    this.store.selectedToToken = isTokenOnSelectedChain(
      token,
      this.store.selectedChain,
    )
      ? token
      : undefined;
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
    const key = `${chain}-${getTxMatchData(tx as any)}`;
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

  getAutoSlippage = () => {
    return this.store.autoSlippage;
  };

  getIsCustomSlippage = () => {
    return this.store.isCustomSlippage;
  };

  getSlippage = () => {
    return this.store.slippage;
  };

  setAutoSlippage = (auto: boolean) => {
    this.store.autoSlippage = auto;
  };

  setIsCustomSlippage = (isCustomSlippage: boolean) => {
    this.store.isCustomSlippage = isCustomSlippage;
  };

  setSlippage = (slippage: string) => {
    this.store.slippage = slippage;
  };

  getRecentSwapToTokens = () => {
    return this.store.recentToTokens || [];
  };

  getOpenSwapHistoryTs = (address: string) => {
    return this.store.openSwapHistoryTs[address] || 0;
  };

  setOpenSwapHistoryTs = (address: string) => {
    this.store.openSwapHistoryTs[address] = Date.now();
  };

  setRecentSwapToToken = (token: TokenItem) => {
    const recentToTokens = this.store.recentToTokens || [];
    this.store.recentToTokens = [
      token,
      ...recentToTokens.filter(
        item => item.id !== token.id || item.chain !== token.chain,
      ),
    ].slice(0, 5);
  };
}
