import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import createPersistStore from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { CHAINS_ENUM } from '@/constant/chains';

export interface LendingServiceStore {
  lastSelectedChain: CHAINS_ENUM;
  skipHealthFactorWarning: boolean;
}

export class LendingService {
  private store?: LendingServiceStore;

  constructor(options: StorageAdapaterOptions) {
    this.store = createPersistStore<LendingServiceStore>(
      {
        name: APP_STORE_NAMES.lending,
        template: {
          lastSelectedChain: CHAINS_ENUM.ETH,
          skipHealthFactorWarning: false,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
  }

  setLastSelectedChain = async (chainId: CHAINS_ENUM) => {
    if (!this.store) {
      throw new Error('LendingService not initialized');
    }
    this.store.lastSelectedChain = chainId;
  };

  getLastSelectedChain = async () => {
    if (!this.store) {
      throw new Error('LendingService not initialized');
    }
    return this.store.lastSelectedChain;
  };

  setSkipHealthFactorWarning = async (skip: boolean) => {
    if (!this.store) {
      throw new Error('LendingService not initialized');
    }
    this.store.skipHealthFactorWarning = skip;
  };

  getSkipHealthFactorWarning = async () => {
    if (!this.store) {
      throw new Error('LendingService not initialized');
    }
    return this.store.skipHealthFactorWarning;
  };
}
