import { INITIAL_OPENAPI_URL, isNonPublicProductionEnv } from '@/constant';
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
  private credentialsFrom?: OpenApiStore;

  store: Store = {
    api: {
      host: INITIAL_OPENAPI_URL,
    },
    apiKey: null,
    apiTime: null,
  };
  constructor(
    options?: StorageAdapaterOptions & {
      name?: APP_STORE_NAMES.openapi | APP_STORE_NAMES.notificationOpenapi;
      credentialsFrom?: OpenApiStore;
    },
  ) {
    const { name = APP_STORE_NAMES.openapi, credentialsFrom } = options || {};
    this.credentialsFrom = credentialsFrom;
    const storage = createPersistStore<Store>(
      {
        name: name,
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
    if (!this.apiKey) {
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
    if (this.credentialsFrom) {
      return this.credentialsFrom.apiKey;
    }

    return this.store.apiKey;
  }

  set apiKey(value: string | null) {
    if (this.credentialsFrom) {
      this.credentialsFrom.apiKey = value;
      return;
    }

    this.store.apiKey = value;
  }

  get apiTime() {
    if (this.credentialsFrom) {
      return this.credentialsFrom.apiTime;
    }

    return this.store.apiTime;
  }

  set apiTime(value: number | null) {
    if (this.credentialsFrom) {
      this.credentialsFrom.apiTime = value;
      return;
    }

    this.store.apiTime = value;
  }

  generateAPIKey = () => {
    const uuid = uuidv4();
    this.apiKey = uuid;
    this.apiTime = Math.floor(Date.now() / 1000);
  };
}

export const openApiStore = new OpenApiStore({
  storageAdapter: appStorage,
});

export const notificationOpenApiStore = new OpenApiStore({
  name: APP_STORE_NAMES.notificationOpenapi,
  storageAdapter: appStorage,
  credentialsFrom: openApiStore,
});

notificationOpenApiStore.host = isNonPublicProductionEnv
  ? INITIAL_OPENAPI_URL.replace('app-api.', 'alpha.')
  : INITIAL_OPENAPI_URL;
