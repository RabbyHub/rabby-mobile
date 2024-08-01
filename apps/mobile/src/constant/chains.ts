import { TestnetChain } from '@/core/services/customTestnetService';
import { supportedChainToChain } from '@/isomorphic/chain';
import { EVENT_UPDATE_CHAIN_LIST, eventBus } from '@/utils/events';
import { Chain, CHAINS_ENUM } from '@debank/common';
import { SupportedChain } from '@rabby-wallet/rabby-api/dist/types';
import axios from 'axios';
import { MMKV } from 'react-native-mmkv';
import { DEFAULT_CHAIN_LIST } from './default-chain-data';

export type { Chain } from '@debank/common';
export { CHAINS_ENUM };

const storage = new MMKV({
  id: 'mmkv.chains',
});

const getChainsFromStorage = () => {
  try {
    const value = storage.getString('chains');
    if (value) {
      return JSON.parse(value) as Chain[];
    }
  } catch (e) {}
};

interface PortfolioChain extends Chain {
  isSupportHistory: boolean;
}

// chainid 如果有值, 资产页面会发起请求

export const syncMainChainList = async () => {
  try {
    const chains: SupportedChain[] = await axios
      .get('https://static.debank.com/supported_chains.json')
      .then(res => res.data);

    const list: Chain[] = chains
      .filter(item => !item.is_disabled)
      .map(item => {
        const chain: Chain = supportedChainToChain(item);

        return chain;
      });
    updateChainStore({
      mainnetList: list,
    });
    storage.set('chains', JSON.stringify(list));
  } catch (e) {
    console.error('fetch chain list error: ', e);
  }
};

const store = {
  mainnetList: getChainsFromStorage() || DEFAULT_CHAIN_LIST,
  testnetList: [] as TestnetChain[],
};

export const updateChainStore = (params: Partial<typeof store>) => {
  Object.assign(store, params);
  eventBus.emit(EVENT_UPDATE_CHAIN_LIST, params);
};

export const getTestnetChainList = () => {
  return store.testnetList;
};

export const getMainnetChainList = () => {
  return store.mainnetList;
};

export const getChainList = (net?: 'mainnet' | 'testnet') => {
  if (net === 'mainnet') {
    return store.mainnetList;
  }
  if (net === 'testnet') {
    return store.testnetList;
  }
  return [...store.mainnetList, ...store.testnetList];
};

export const getCHAIN_ID_LIST = () =>
  new Map<string, PortfolioChain>(
    getChainList('mainnet').map(chain => {
      return [chain.serverId, { ...chain, isSupportHistory: false }];
    }),
  );
