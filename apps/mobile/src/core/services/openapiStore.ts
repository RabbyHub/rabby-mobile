import { INITIAL_OPENAPI_URL } from '@/constant';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import createPersistStore from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { appStorage } from '../storage/mmkv';
import { v4 as uuidv4 } from 'uuid';

export type Store = {
  api: {
    host: string;
  };
  apiKey: string | null;
  apiTime: number | null;
};

export class OpenApiStore {
  store: Store = {
    api: {
      host: INITIAL_OPENAPI_URL,
    },
    apiKey: null,
    apiTime: null,
  };
  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<Store>(
      {
        name: APP_STORE_NAMES.openapi,
        template: {
          api: {
            host: INITIAL_OPENAPI_URL,
          },
          apiKey: null,
          apiTime: null,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );

    this.store = storage || this.store;
    if (!this.store.apiKey) {
      this.generateAPIKey();
    }
  }
  get host() {
    return this.store.api.host;
  }

  set host(v: string) {
    this.store.api = {
      ...this.store.api,
      host: v,
    };
  }

  get apiKey() {
    return this.store.apiKey;
  }

  set apiKey(value: string | null) {
    this.store.apiKey = value;
  }

  get apiTime() {
    return this.store.apiTime;
  }

  set apiTime(value: number | null) {
    this.store.apiTime = value;
  }

  generateAPIKey = () => {
    const uuid = uuidv4();
    this.store.apiKey = uuid;
    this.store.apiTime = Math.floor(Date.now() / 1000);
  };
}

export const openApiStore = new OpenApiStore({
  storageAdapter: appStorage,
});
