import { CHAINS_ENUM, Chain } from '@debank/common';

export type { Chain } from '@debank/common';
export { CHAINS_ENUM };
import { MMKV } from 'react-native-mmkv';
import { keyBy } from 'lodash';
import { DEFAULT_CHAIN_LIST } from './default-chain-data';
import { supportedChainToChain } from '@/isomorphic/chain';
import axios from 'axios';
import { SupportedChain } from '@rabby-wallet/rabby-api/dist/types';
import { TestnetChain } from '@/core/services/customTestnetService';
import { eventBus } from '@rabby-wallet/keyring-utils';
import { EVENT_UPDATE_CHAIN_LIST, EVENTS } from '@/utils/events';

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

export const CHAINS_LIST = getChainsFromStorage() || DEFAULT_CHAIN_LIST;

export const CHAINS = keyBy(CHAINS_LIST, 'enum');

export const MAINNET_CHAINS_LIST = CHAINS_LIST.filter(
  chain => !chain.isTestnet,
);
export const TESTNET_CHAINS_LIST = CHAINS_LIST.filter(chain => chain.isTestnet);

export const CHAINS_BY_NET = {
  mainnet: MAINNET_CHAINS_LIST,
  testnet: TESTNET_CHAINS_LIST,
};

interface PortfolioChain extends Chain {
  isSupportHistory: boolean;
}

// chainid 如果有值, 资产页面会发起请求
export const CHAIN_ID_LIST = new Map<string, PortfolioChain>(
  Object.values(CHAINS).map(chain => {
    return [chain.serverId, { ...chain, isSupportHistory: false }];
  }),
);

export const syncChainList = async () => {
  try {
    const chains: SupportedChain[] = await axios
      .get('https://static.debank.com/supported_chains.json')
      .then(res => res.data);

    const chainServerIdDict = keyBy(CHAINS_LIST, 'serverId');

    const list: Chain[] = chains
      .filter(item => !item.is_disabled)
      .map(item => {
        const chain: Chain = supportedChainToChain(item);
        CHAIN_ID_LIST.set(chain.serverId, {
          ...chain,
          isSupportHistory: false,
        });
        return chain;
      });
    replaceArray(CHAINS_LIST, list);
    replaceObject(CHAINS, keyBy(CHAINS_LIST, 'enum'));
    replaceArray(
      MAINNET_CHAINS_LIST,
      CHAINS_LIST.filter(chain => !chain.isTestnet),
    );
    replaceArray(
      TESTNET_CHAINS_LIST,
      CHAINS_LIST.filter(chain => chain.isTestnet),
    );
    storage.set('chains', JSON.stringify(list));
  } catch (e) {
    console.error('fetch chain list error: ', e);
  }
};

const replaceObject = (target: object, source: object) => {
  const keys = Object.keys(target);
  keys.forEach(key => delete target[key]);
  Object.assign(target, source);
};

const replaceArray = <V extends any>(target: V[], source: V[]) => {
  target.length = 0;
  source.forEach(item => {
    target.push(item);
  });
};

const store = {
  mainnetList: getChainsFromStorage() || DEFAULT_CHAIN_LIST,
  testnetList: [] as TestnetChain[],
};

export const updateChainStore = (params: Partial<typeof store>) => {
  Object.assign(store, params);
  console.log(store);
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
