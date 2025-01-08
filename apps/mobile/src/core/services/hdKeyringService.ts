import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import dayjs from 'dayjs';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

export type Store = Record<string, number>;

export class HDKeyringService {
  store!: Store;

  constructor(options?: StorageAdapaterOptions) {
    this.init(options);
  }

  init = async (options?: StorageAdapaterOptions) => {
    this.store = await createPersistStore<Store>(
      {
        name: APP_STORE_NAMES.HDKeyRingLastAddAddrTime,
        template: {},
      },
      {
        storage: options?.storageAdapter,
      },
    );
  };

  addUnixRecord = (basePublicKey: string) => {
    this.store[basePublicKey] = dayjs().unix();
  };

  getStore = () => {
    return this.store;
  };
}
