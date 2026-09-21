import {
  mockClearCloseTipsChains,
  offlineChainServiceApi,
  setCloseTipsChains,
} from '@/core/serviceApi/offlineChain';
import type { OfflineChainService } from '@/core/services/offlineChain';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';

type ClosedTipsState = {
  closedTipsChains: string[];
  hydrated: boolean;
};

export const closedTipsStore = zCreate<ClosedTipsState>(() => ({
  closedTipsChains: [],
  hydrated: false,
}));

let closedTipsHydrationPromise: Promise<void> | null = null;
let closedTipsRevision = 0;

export function hydrateClosedTipsChains() {
  if (!closedTipsHydrationPromise) {
    const revision = closedTipsRevision;
    closedTipsHydrationPromise = offlineChainServiceApi
      .getCloseTipsChains()
      .then(closedTipsChains => {
        if (revision === closedTipsRevision) {
          closedTipsStore.setState({ closedTipsChains, hydrated: true });
        }
      })
      .finally(() => {
        closedTipsHydrationPromise = null;
      });
  }
  return closedTipsHydrationPromise;
}

export function prepareOfflineChainStoreFromService(
  service: OfflineChainService,
) {
  closedTipsRevision += 1;
  closedTipsStore.setState({
    closedTipsChains: service.getCloseTipsChains(),
    hydrated: true,
  });
}

function setClosedTipsChainState(
  valOrFunc: UpdaterOrPartials<ClosedTipsState['closedTipsChains']>,
) {
  closedTipsRevision += 1;
  closedTipsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.closedTipsChains, valOrFunc);

    void setCloseTipsChains(newVal).catch(console.error);

    return { ...prev, closedTipsChains: newVal, hydrated: true };
  });
}

export const clearOfflineChainTips = () => {
  void mockClearCloseTipsChains().catch(console.error);
  setClosedTipsChainState([]);
};

export const setClosedTipsChain = (chain: string) => {
  setClosedTipsChainState(previous => [...previous, chain]);
};
