import { DEX_ENUM } from '@rabby-wallet/rabby-swap';
import { CHAINS_ENUM } from '@debank/common';
import cloneDeep from 'lodash/cloneDeep';
import type { Draft } from 'mutative';
import type { GasCache, ChainGas } from '../startupServices/preference';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
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

const sanitizeSelectedTokens = (store: Draft<SwapServiceStore>) => {
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

export class SwapService extends StoreServiceBase<
  SwapServiceStore,
  APP_STORE_NAMES.swap
> {
  constructor(options?: StorageAdapaterOptions) {
    super(
      APP_STORE_NAMES.swap,
      {
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
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.mutateStore(draft => {
      const values = Object.values(DEX_ENUM);
      if (draft.selectedDex && !values.includes(draft.selectedDex)) {
        draft.selectedDex = null;
      }

      if (
        draft.selectedChain &&
        !SWAP_SUPPORT_CHAINS.includes(draft.selectedChain)
      ) {
        draft.selectedChain = null;
        draft.selectedFromToken = undefined;
        draft.selectedToToken = undefined;
      }

      sanitizeSelectedTokens(draft);

      if (draft.recentToTokens?.length) {
        draft.recentToTokens = draft.recentToTokens.filter(item => {
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

      if (typeof draft.openSwapHistoryTs !== 'object') {
        draft.openSwapHistoryTs = {};
      }
    });
  }

  handleUnsupportedChain = () => {
    this.mutateStore(draft => {
      if (
        draft.selectedChain &&
        !SWAP_SUPPORT_CHAINS.includes(draft.selectedChain)
      ) {
        draft.selectedChain = null;
        draft.selectedFromToken = undefined;
        draft.selectedToToken = undefined;
        return;
      }
      sanitizeSelectedTokens(draft);
    });
  };

  getSwap = <K extends keyof SwapServiceStore>(key?: K) => {
    return cloneDeep(key ? this.store[key] : this.store);
  };

  getLastTimeGasSelection = (chainId: keyof GasCache): ChainGas | null => {
    const cache = this.store.gasPriceCache[chainId];
    if (cache && cache.lastTimeSelect === 'gasPrice') {
      if (Date.now() <= (cache.expireAt || 0)) {
        return cloneDeep(cache);
      } else if (cache.gasLevel) {
        return {
          lastTimeSelect: 'gasLevel',
          gasLevel: cache.gasLevel,
        };
      } else {
        return null;
      }
    } else {
      return cloneDeep(cache);
    }
  };

  updateLastTimeGasSelection = (chainId: keyof GasCache, gas: ChainGas) => {
    this.mutateStore(draft => {
      draft.gasPriceCache[chainId] = {
        ...draft.gasPriceCache[chainId],
        ...gas,
        ...(gas.lastTimeSelect === 'gasPrice'
          ? { expireAt: Date.now() + 3600000 }
          : {}),
      };
    });
  };

  getSelectedDex = () => {
    return this.store.selectedDex;
  };

  setSelectedDex = (dexId: DEX_ENUM) => {
    this.mutateStore(draft => {
      draft.selectedDex = dexId;
    });
  };

  getSelectedChain = () => {
    this.handleUnsupportedChain();
    return this.store.selectedChain;
  };

  setSelectedChain = (chain: CHAINS_ENUM) => {
    this.mutateStore(draft => {
      draft.selectedChain = chain;
      sanitizeSelectedTokens(draft);
    });
  };

  getSelectedFromToken = () => {
    this.handleUnsupportedChain();
    return this.getStoreFieldSnapshot('selectedFromToken');
  };
  getSelectedToToken = () => {
    this.handleUnsupportedChain();
    return this.getStoreFieldSnapshot('selectedToToken');
  };

  setSelectedFromToken = (token?: TokenItem) => {
    this.mutateStore(draft => {
      draft.selectedFromToken = isTokenOnSelectedChain(
        token,
        draft.selectedChain,
      )
        ? cloneDeep(token)
        : undefined;
    });
  };
  setSelectedToToken = (token?: TokenItem) => {
    this.mutateStore(draft => {
      draft.selectedToToken = isTokenOnSelectedChain(token, draft.selectedChain)
        ? cloneDeep(token)
        : undefined;
    });
  };

  getUnlimitedAllowance = () => {
    return this.store.unlimitedAllowance;
  };

  setUnlimitedAllowance = (bool: boolean) => {
    this.mutateStore(draft => {
      draft.unlimitedAllowance = bool;
    });
  };

  getSwapViewList = () => {
    return this.getStoreFieldSnapshot('viewList');
  };

  setSwapView = (id: ViewKey, bool: boolean) => {
    this.mutateStore(draft => {
      draft.viewList ||= {} as SwapServiceStore['viewList'];
      draft.viewList[id] = bool;
    });
  };

  getSwapTradeList = () => {
    return this.getStoreFieldSnapshot('tradeList');
  };

  setSwapTrade = (dexId: ViewKey, bool: boolean) => {
    this.mutateStore(draft => {
      draft.tradeList ||= {} as SwapServiceStore['tradeList'];
      draft.tradeList[dexId] = bool;
    });
  };

  getSwapSortIncludeGasFee = () => {
    return this.store.sortIncludeGasFee ?? true;
  };

  setSwapSortIncludeGasFee = (bool: boolean) => {
    this.mutateStore(draft => {
      draft.sortIncludeGasFee = bool;
    });
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
    this.mutateStore(draft => {
      draft.preferMEVGuarded = bool;
    });
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
    this.mutateStore(draft => {
      draft.autoSlippage = auto;
    });
  };

  setIsCustomSlippage = (isCustomSlippage: boolean) => {
    this.mutateStore(draft => {
      draft.isCustomSlippage = isCustomSlippage;
    });
  };

  setSlippage = (slippage: string) => {
    this.mutateStore(draft => {
      draft.slippage = slippage;
    });
  };

  getRecentSwapToTokens = () => {
    return this.getStoreFieldSnapshot('recentToTokens') || [];
  };

  getOpenSwapHistoryTs = (address: string) => {
    return this.store.openSwapHistoryTs[address] || 0;
  };

  setOpenSwapHistoryTs = (address: string) => {
    this.mutateStore(draft => {
      draft.openSwapHistoryTs[address] = Date.now();
    });
  };

  setRecentSwapToToken = (token: TokenItem) => {
    this.mutateStore(draft => {
      const recentToTokens = draft.recentToTokens || [];
      draft.recentToTokens = [
        cloneDeep(token),
        ...recentToTokens.filter(
          item => item.id !== token.id || item.chain !== token.chain,
        ),
      ].slice(0, 5);
    });
  };
}
