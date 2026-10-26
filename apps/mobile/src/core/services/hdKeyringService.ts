import cloneDeep from 'lodash/cloneDeep';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import dayjs from 'dayjs';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

export type Store = Record<string, number>;

export class HDKeyringService extends StoreServiceBase<
  Store,
  APP_STORE_NAMES.HDKeyRingLastAddAddrTime
> {
  constructor(options?: StorageAdapaterOptions) {
    super();
    this.init(options);
  }

  init = async (options?: StorageAdapaterOptions) => {
    await Promise.resolve();
    this.initializePersistStore(
      APP_STORE_NAMES.HDKeyRingLastAddAddrTime,
      {},
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  };

  addUnixRecord = (basePublicKey: string) => {
    this.mutateStore(draft => {
      draft[basePublicKey] = dayjs().unix();
    });
  };

  getStore = () => {
    return this.getStoreSnapshot();
  };
}
