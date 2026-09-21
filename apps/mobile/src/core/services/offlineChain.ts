import cloneDeep from 'lodash/cloneDeep';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { isNonPublicProductionEnv } from '@/constant';

export type OfflineChainStore = {
  closeTipsChains: string[];
};

export class OfflineChainService extends StoreServiceBase<
  OfflineChainStore,
  APP_STORE_NAMES.offlineChain
> {
  constructor(options?: StorageAdapaterOptions) {
    super(
      APP_STORE_NAMES.offlineChain,
      { closeTipsChains: [] },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }

  getCloseTipsChains = () => {
    return this.getStoreFieldSnapshot('closeTipsChains');
  };

  setCloseTipsChains = (chains: string[]) => {
    this.mutateStore(draft => {
      draft.closeTipsChains.push(...chains);
    });
  };

  mockClearCloseTipsChains = () => {
    if (!isNonPublicProductionEnv) return;
    this.mutateStore(draft => {
      draft.closeTipsChains = [];
    });
  };
}
