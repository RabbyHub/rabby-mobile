import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { isNonPublicProductionEnv } from '@/constant';

export type OfflineChainStore = {
  closeTipsChains: string[];
};

export class OfflineChainService {
  store: OfflineChainStore = {
    closeTipsChains: [],
  };

  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<OfflineChainStore>(
      {
        name: APP_STORE_NAMES.offlineChain,
        template: {
          closeTipsChains: [],
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );

    this.store = storage || this.store;
  }

  getCloseTipsChains = () => {
    return this.store.closeTipsChains;
  };

  setCloseTipsChains = (chains: string[]) => {
    this.store.closeTipsChains = [...this.store.closeTipsChains, ...chains];
  };

  mockClearCloseTipsChains = () => {
    if (!isNonPublicProductionEnv) return;
    this.store.closeTipsChains = [];
  };
}
