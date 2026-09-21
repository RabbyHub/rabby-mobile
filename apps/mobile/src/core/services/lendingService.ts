import {
  StoreServiceBase,
  type StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { CustomMarket } from '@/screens/Lending/config/market';

export interface LendingServiceStore {
  lastSelectedChain: CustomMarket;
  skipHealthFactorWarning: boolean;
}

export class LendingService extends StoreServiceBase<
  LendingServiceStore,
  APP_STORE_NAMES.lending
> {
  constructor(options: StorageAdapaterOptions) {
    super(
      APP_STORE_NAMES.lending,
      {
        lastSelectedChain: CustomMarket.proto_mainnet_v3,
        skipHealthFactorWarning: false,
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }

  setLastSelectedChain = async (chainId: CustomMarket) => {
    this.mutateStore(draft => {
      draft.lastSelectedChain = chainId;
    });
  };

  getLastSelectedChain = () => {
    return this.store.lastSelectedChain;
  };

  setSkipHealthFactorWarning = async (skip: boolean) => {
    this.mutateStore(draft => {
      draft.skipHealthFactorWarning = skip;
    });
  };

  getSkipHealthFactorWarning = () => {
    return this.store.skipHealthFactorWarning;
  };
}
