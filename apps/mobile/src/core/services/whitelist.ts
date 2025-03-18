import { addressUtils } from '@rabby-wallet/base-utils';
import createPersistStore from '@rabby-wallet/persist-store';
import { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

const { isSameAddress } = addressUtils;

export type WhitelistStore = {
  enabled: boolean;
  whitelists: string[];
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
  }

  getWhitelist = () => {
    return this.store.whitelists;
  };

  enableWhitelist = () => {
    this.store.enabled = true;
  };

  disableWhiteList = () => {
    this.store.enabled = false;
  };

  setWhitelist = (addresses: string[]) => {
    this.store.whitelists = addresses.map(address => address.toLowerCase());
  };

  removeWhitelist = (address: string) => {
    if (!this.store.whitelists.find(item => isSameAddress(item, address))) {
      return;
    }
    this.store.whitelists = this.store.whitelists.filter(
      item => !isSameAddress(item, address),
    );
  };

  addWhitelist = (address: string) => {
    if (!address) {
      return;
    }
    if (this.store.whitelists.find(item => isSameAddress(item, address))) {
      return;
    }
    this.store.whitelists = [...this.store.whitelists, address.toLowerCase()];
  };

  isWhitelistEnabled = () => {
    return this.store.enabled;
  };

  isInWhiteList = (address: string) => {
    return this.store.whitelists.some(item => isSameAddress(item, address));
  };
}
