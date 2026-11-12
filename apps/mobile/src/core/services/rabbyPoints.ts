import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { normalizeAddressKey } from '@/utils/address';

export type RabbyPointsStore = {
  signatures: Record<string, string>;
};

export class RabbyPointsService extends StoreServiceBase<
  RabbyPointsStore,
  APP_STORE_NAMES.RabbyPoints
> {
  constructor(options?: StorageAdapaterOptions) {
    super(
      APP_STORE_NAMES.RabbyPoints,
      { signatures: {} },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }

  setSignature = (addr: string, signature: string) => {
    this.mutateStore(draft => {
      draft.signatures[normalizeAddressKey(addr)] = signature;
    });
  };

  getSignature = (addr: string) => {
    return this.store.signatures[normalizeAddressKey(addr)];
  };
  clearSignatureByAddr = (addr: string) => {
    this.mutateStore(draft => {
      delete draft.signatures[normalizeAddressKey(addr)];
    });
  };
  clearSignature = () => {
    this.mutateStore(draft => {
      draft.signatures = {};
    });
  };
}
