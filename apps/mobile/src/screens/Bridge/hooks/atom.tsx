import { openapi } from '@/core/request';
import { findChainByServerID } from '@/utils/chain';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { BridgeAggregator } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtomValue } from 'jotai';

const bridgeSupportedChainsAtom = atom(
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

bridgeSupportedChainsAtom.onMount = setAtom => {
  openapi.getBridgeSupportChainV2().then(chains => {
    if (chains.length) {
      const mappings = Object.values(CHAINS).reduce((acc, chain) => {
        acc[chain.serverId] = chain.enum;
        return acc;
      }, {} as Record<string, CHAINS_ENUM>);
      setAtom(
        chains.map(item => findChainByServerID(item)?.enum || mappings[item]),
      );
    }
  });
};

const aggregatorsListAtom = atom<BridgeAggregator[]>([]);

aggregatorsListAtom.onMount = setAtom => {
  openapi.getBridgeAggregatorList().then(s => {
    setAtom(s);
  });
};

export const useBridgeSupportedChains = () =>
  useAtomValue(bridgeSupportedChainsAtom);

export const useAggregatorsList = () => useAtomValue(aggregatorsListAtom);
