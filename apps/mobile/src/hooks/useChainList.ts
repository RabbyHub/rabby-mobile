import { getChainList } from '@/constant/chains';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { EVENT_UPDATE_CHAIN_LIST, eventBus } from '@/utils/events';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

type ChainListState = {
  mainnetList: ReturnType<typeof getChainList>;
  testnetList: ReturnType<typeof getChainList>;
};
const chainListStore = zCreate<ChainListState>(() => {
  return {
    mainnetList: getChainList('mainnet'),
    testnetList: getChainList('testnet'),
  };
});

export function setChainList(valOrFunc: UpdaterOrPartials<ChainListState>) {
  return chainListStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

eventBus.on(EVENT_UPDATE_CHAIN_LIST, v => {
  setChainList(prev => {
    return {
      ...prev,
      ...v,
    };
  });
});

export const useChainList = () => {
  const chainList = useActivityStore(
    chainListStore,
    state => state,
    Object.is,
    { storeLabel: 'chain-list' },
  );

  return {
    ...chainList,
  };
};

export const useMainnetChainList = () =>
  useActivityStore(chainListStore, state => state.mainnetList, Object.is, {
    storeLabel: 'mainnet-chain-list',
  });
