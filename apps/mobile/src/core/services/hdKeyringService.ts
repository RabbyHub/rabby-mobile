import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import dayjs from 'dayjs';

export type Store = Record<string, number>;

export class HDKeyringService {
  store!: Store;

  constructor(options?: StorageAdapaterOptions) {
    this.init(options);
  }

  init = async (options?: StorageAdapaterOptions) => {
    this.store = await createPersistStore<Store>(
      {
        name: 'HDKeyRingLastAddAddrTime',
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
