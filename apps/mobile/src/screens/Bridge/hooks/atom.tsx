import { ensureChainListValid } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { ALL_SUPPORTED_BRIDGE_CHAINS } from '@rabby-wallet/rabby-bridge';
import { BridgeAggregator } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtomValue } from 'jotai';
import { openapi } from '@/core/request';

const bridgeSupportedChainsAtom = atom(
  ensureChainListValid(ALL_SUPPORTED_BRIDGE_CHAINS as CHAINS_ENUM[]),
);

const aggregatorsListAtom = atom<BridgeAggregator[]>([]);

aggregatorsListAtom.onMount = setAtom => {
  openapi.getBridgeAggregatorList().then(s => {
    console.log('getBridgeAggregatorList', s);
    setAtom(s);
  });
};

export const useBridgeSupportedChains = () =>
  useAtomValue(bridgeSupportedChainsAtom);

export const useAggregatorsList = () => useAtomValue(aggregatorsListAtom);
