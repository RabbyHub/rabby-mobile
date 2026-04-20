import { addressUtils } from '@rabby-wallet/base-utils';
import createPersistStore from '@rabby-wallet/persist-store';
import { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import {
  mergeWhitelistRecords,
  normalizeWhitelistRecords,
  type WhitelistRecord,
} from '@/utils/whitelist';

const { isSameAddress } = addressUtils;

export type WhitelistStore = {
  enabled: boolean;
  whitelists: WhitelistRecord[];
};

export class WhitelistService {
  store: WhitelistStore = {
    enabled: true,
    whitelists: [],
  };

  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<WhitelistStore>(
      {
        name: APP_STORE_NAMES.whitelist,
        template: {
          enabled: true,
          whitelists: [],
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    this.store = storage || this.store;
    if (!this.store.enabled) {
      this.store.enabled = true;
    }
    this.store.whitelists = normalizeWhitelistRecords(
      this.store.whitelists as unknown as Array<string | WhitelistRecord>,
    );
  }

  getWhitelist = () => {
    return this.store.whitelists.map(item => item.address);
  };

  getWhitelistRecords = () => {
    return this.store.whitelists;
  };

  enableWhitelist = () => {
    this.store.enabled = true;
  };

  disableWhiteList = () => {
    this.store.enabled = false;
  };

  setWhitelist = (addresses: string[]) => {
    this.store.whitelists = normalizeWhitelistRecords(addresses);
  };

  removeWhitelist = (address: string) => {
    if (
      !this.store.whitelists.find(item => isSameAddress(item.address, address))
    ) {
      return;
    }
    this.store.whitelists = this.store.whitelists.filter(
      item => !isSameAddress(item.address, address),
    );
  };

  addWhitelist = (address: string) => {
    if (!address) {
      return;
    }

    this.store.whitelists = mergeWhitelistRecords(this.store.whitelists, [
      address,
    ]);
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
