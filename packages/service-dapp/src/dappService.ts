import type { CHAINS_ENUM } from '@debank/common';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { createPersistStore } from '@rabby-wallet/persist-store';

import { INTERNAL_REQUEST_ORIGIN } from './constant';

export interface BasicDappInfo {
  id: string;
  name: string;
  logo_url: string;
  description: string;
  user_range: string;
  tags: string[];
}

export interface DappInfo {
  info: BasicDappInfo;
  infoUpdateAt?: number;
  isFavorite?: boolean;
  isConnected?: boolean;
  isSigned?: boolean;
  chainId: CHAINS_ENUM;
  lastPath?: string; // 待定
  lastPathTimeAt?: number; //
}

export type dappStore = {
  dapps: Record<string, DappInfo>;
};

export class DappService {
  private readonly store: dappStore;

  constructor(options?: StorageAdapaterOptions) {
    this.store = createPersistStore<dappStore>(
      {
        name: 'dapps',
        template: {
          dapps: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
  }

  addDapp(dapp: DappInfo | DappInfo[]) {
    const dapps = Array.isArray(dapp) ? dapp : [dapp];
    dapps.forEach(item => {
      this.store.dapps[item.info.id] = item;
    });
    this.store.dapps = { ...this.store.dapps };
  }

  isConnected(id: string) {
    if (id === INTERNAL_REQUEST_ORIGIN) {
      return true;
    }
    const dapp = this.getDapp(id);
    return dapp ? dapp.isConnected : false;
  }

  getDapp(id: string) {
    return this.store.dapps[id];
  }

  getDapps() {
    return this.store.dapps;
  }

  getConnectedDapp(id: string) {
    const dapp = this.getDapp(id);
    if (dapp.isConnected) {
      return dapp;
    }
    return null;
  }

  removeDapp(id: string) {
    delete this.store.dapps[id];
    this.store.dapps = { ...this.store.dapps };
  }

  updateDapp(dapp: DappInfo) {
    this.store.dapps[dapp.info.id] = dapp;
    this.store.dapps = { ...this.store.dapps };
  }

  updateFavorite(origin: string, isFavorite: boolean) {
    this.store.dapps[origin] = {
      ...this.store.dapps[origin],
      isFavorite,
    };

    this.store.dapps = { ...this.store.dapps };
  }

  updateConnected(origin: string, isConnected: boolean) {
    this.store.dapps[origin].isConnected = isConnected;
    this.store.dapps = { ...this.store.dapps };
  }

  disconnect(origin: string) {
    this.store.dapps[origin].isConnected = false;
    this.store.dapps = { ...this.store.dapps };
  }

  setChainId(origin: string, chainId: CHAINS_ENUM) {
    this.store.dapps[origin].chainId = chainId;
    this.store.dapps = { ...this.store.dapps };
  }

  isInternalDapp(origin: string) {
    // TODO: use real condition
    return false;
  }
}
