import { INITIAL_OPENAPI_URL } from '@/constant';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { appStorage } from '../storage/mmkv';

export type Store = {
  api: {
    host: string;
  };
};

export class OpenApiStore extends StoreServiceBase<Store, 'openapi'> {
  constructor(options?: StorageAdapaterOptions<Store>) {
    super(
      APP_STORE_NAMES.openapi,
      {
        api: {
          host: INITIAL_OPENAPI_URL,
        },
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }
  get host() {
    return this.store.api.host;
  }

  set host(v: string) {
    this.store.api = {
      host: v,
    };
  }
}

export const openApiStore = new OpenApiStore({
  storageAdapter: appStorage,
});
