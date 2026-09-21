import { INITIAL_OPENAPI_URL, isNonPublicProductionEnv } from '@/constant';
import {
  StoreServiceBase,
  type StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { v4 as uuidv4 } from 'uuid';
import { APP_STORE_NAMES } from './storeConstant';
import { appStorage } from './mmkv';

export type Store = {
  api: {
    host: string;
  };
  apiKey: string | null;
  apiTime: number | null;
};

export class OpenApiStore extends StoreServiceBase<
  Store,
  APP_STORE_NAMES.openapi | APP_STORE_NAMES.notificationOpenapi
> {
  private credentialsFrom?: OpenApiStore;

  constructor(
    options?: StorageAdapaterOptions & {
      name?: APP_STORE_NAMES.openapi | APP_STORE_NAMES.notificationOpenapi;
      credentialsFrom?: OpenApiStore;
    },
  ) {
    const { name = APP_STORE_NAMES.openapi, credentialsFrom } = options || {};
    super(
      name,
      {
        api: {
          host: INITIAL_OPENAPI_URL,
        },
        apiKey: null,
        apiTime: null,
      },
      { storageAdapter: options?.storageAdapter },
    );
    this.credentialsFrom = credentialsFrom;
    if (!this.apiKey) {
      this.generateAPIKey();
    }
  }
  get host() {
    return this.store.api.host;
  }

  set host(v: string) {
    this.mutateStore(draft => {
      draft.api.host = v;
    });
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

    this.mutateStore(draft => {
      draft.apiKey = value;
    });
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

    this.mutateStore(draft => {
      draft.apiTime = value;
    });
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
