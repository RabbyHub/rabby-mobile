import { openapi } from '@/core/request';
import { findChainByServerID } from '@/utils/chain';
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
  openapi.getBridgeSupportChain().then(s => {
    setAtom(s.map(e => findChainByServerID(e)!.enum || e));
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
