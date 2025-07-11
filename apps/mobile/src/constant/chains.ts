import { TestnetChain } from '@/core/services/customTestnetService';
import { EVENT_UPDATE_CHAIN_LIST, eventBus } from '@/utils/events';
import { Chain, CHAINS_ENUM } from '@debank/common';
import { DEFAULT_CHAIN_LIST } from './default-chain-data';

export type { Chain } from '@debank/common';
export { CHAINS_ENUM };

interface PortfolioChain extends Chain {
  isSupportHistory: boolean;
}

const store = {
  mainnetList: DEFAULT_CHAIN_LIST,
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
