import { addressUtils } from '@rabby-wallet/base-utils';
import cloneDeep from 'lodash/cloneDeep';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import {
  addWhitelistRecord,
  normalizeWhitelistRecords,
  reorderWhitelistRecords,
  syncWhitelistRecords,
  type WhitelistRecord,
} from '@/utils/whitelist';

const { isSameAddress } = addressUtils;

export type WhitelistStore = {
  enabled: boolean;
  whitelists: WhitelistRecord[];
};

export class WhitelistService extends StoreServiceBase<
  WhitelistStore,
  APP_STORE_NAMES.whitelist
> {
  constructor(options?: StorageAdapaterOptions) {
    super(
      APP_STORE_NAMES.whitelist,
      {
        enabled: true,
        whitelists: [],
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
    this.mutateStore(draft => {
      if (!draft.enabled) {
        draft.enabled = true;
      }
      draft.whitelists = normalizeWhitelistRecords(draft.whitelists);
    });
  }

  getWhitelist = () => {
    return this.store.whitelists.map(item => item.address);
  };

  getWhitelistRecords = () => {
    return this.getStoreFieldSnapshot('whitelists');
  };

  applyWhitelistMigration = (
    records: ReadonlyArray<string | Readonly<WhitelistRecord>>,
  ) => {
    this.mutateStore(draft => {
      draft.whitelists = normalizeWhitelistRecords([...records]);
    });
  };

  enableWhitelist = () => {
    this.mutateStore(draft => {
      draft.enabled = true;
    });
  };

  disableWhiteList = () => {
    this.mutateStore(draft => {
      draft.enabled = false;
    });
  };

  setWhitelist = (addresses: string[]) => {
    this.mutateStore(draft => {
      draft.whitelists = syncWhitelistRecords(draft.whitelists, addresses);
    });
  };

  updateWhitelistOrder = (addresses: string[]) => {
    this.mutateStore(draft => {
      draft.whitelists = reorderWhitelistRecords(draft.whitelists, addresses);
    });
  };

  removeWhitelist = (address: string) => {
    if (
      !this.store.whitelists.find(item => isSameAddress(item.address, address))
    ) {
      return;
    }
    this.mutateStore(draft => {
      draft.whitelists = draft.whitelists.filter(
        item => !isSameAddress(item.address, address),
      );
    });
  };

  addWhitelist = (address: string) => {
    if (!address) {
      return;
    }

    this.mutateStore(draft => {
      draft.whitelists = addWhitelistRecord(draft.whitelists, address);
    });
  };

  isWhitelistEnabled = () => {
    return this.store.enabled;
  };

  isInWhiteList = (address: string) => {
    return this.store.whitelists.some(item =>
      isSameAddress(item.address, address),
    );
  };
}
