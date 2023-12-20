import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { createPersistStore } from '@rabby-wallet/persist-store';

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
  chainId?: string;
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
  }

  getDapp(id: string) {
    return this.store.dapps[id];
  }

  getDapps() {
    return this.store.dapps;
  }

  removeDapp(id: string) {
    delete this.store.dapps[id];
  }

  updateDapp(dapp: DappInfo) {
    this.store.dapps[dapp.info.id] = dapp;
  }

  updateFavorite(origin: string, isFavorite: boolean) {
    this.store.dapps[origin] = {
      ...this.store.dapps[origin],
      isFavorite,
    };
  }

  updateConnected(origin: string, isConnected: boolean) {
    this.store.dapps[origin].isConnected = isConnected;
  }

  disconnect(origin: string) {
    this.store.dapps[origin].isConnected = false;
  }

  setChainId(origin: string, chainId: string) {
    this.store.dapps[origin].chainId = chainId;
  }
}
