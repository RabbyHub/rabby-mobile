import { openapi } from '@/core/request';
import { findChainByServerID } from '@/utils/chain';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { BridgeAggregator } from '@rabby-wallet/rabby-api/dist/types';
import { zCreate } from '@/core/utils/reexports';
import { runIIFEFunc } from '@/core/utils/store';

// Zustand implementation for bridgeSupportedChains
const bridgeSupportedChainsStore = zCreate<CHAINS_ENUM[]>(() =>
  [
    'arb',
    'matic',
    'era',
    'base',
    'op',
    'linea',
    'xdai',
    'eth',
    'mnt',
    'mode',
    'bsc',
    'scrl',
    'avax',
    'zora',
  ].map(e => findChainByServerID(e)!.enum || e),
);

runIIFEFunc(() => {
  openapi.getBridgeSupportChainV2().then(chains => {
    if (chains.length) {
      const mappings = Object.values(CHAINS).reduce((acc, chain) => {
        acc[chain.serverId] = chain.enum;
        return acc;
      }, {} as Record<string, CHAINS_ENUM>);
      bridgeSupportedChainsStore.setState(
        chains.map(item => findChainByServerID(item)?.enum || mappings[item]),
      );
    }
  });
});

// Zustand implementation for aggregatorsList
const aggregatorsListStore = zCreate<BridgeAggregator[]>(() => []);
runIIFEFunc(() => {
  openapi.getBridgeAggregatorList().then(s => {
    aggregatorsListStore.setState(s);
  });
});

export const useBridgeSupportedChains = () => bridgeSupportedChainsStore();

export const useAggregatorsList = () => aggregatorsListStore();
