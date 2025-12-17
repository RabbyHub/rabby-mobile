import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import createPersistStore from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { CustomMarket } from '@/screens/Lending/config/market';

export interface LendingServiceStore {
  lastSelectedChain: CustomMarket;
  skipHealthFactorWarning: boolean;
}

export class LendingService {
  private store?: LendingServiceStore;

  constructor(options: StorageAdapaterOptions) {
    this.store = createPersistStore<LendingServiceStore>(
      {
        name: APP_STORE_NAMES.lending,
        template: {
          lastSelectedChain: CustomMarket.proto_mainnet_v3,
          skipHealthFactorWarning: false,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
  }

  setLastSelectedChain = async (chainId: CustomMarket) => {
    if (!this.store) {
      throw new Error('LendingService not initialized');
    }
    this.store.lastSelectedChain = chainId;
  };

  getLastSelectedChain = () => {
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
