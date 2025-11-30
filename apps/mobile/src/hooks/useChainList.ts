import { getChainList } from '@/constant/chains';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { EVENT_UPDATE_CHAIN_LIST, eventBus } from '@/utils/events';
import { atom, useAtom } from 'jotai';

// export const chainListAtom = atom({
//   mainnetList: getChainList('mainnet'),
//   testnetList: getChainList('testnet'),
// });
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
  // const [chainList] = useAtom(chainListAtom);
  const chainList = chainListStore(s => s);

  return {
    ...chainList,
  };
};
