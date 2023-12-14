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
  origin: string;
  info: BasicDappInfo;
  inforUpdateAt: number;
  isFavorite: boolean;
  isConnected: boolean;
  chainId: string;
  lastPath: string; // 待定
  lastPathTimeAt: number; //
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

  getDapp(origin: string) {
    return this.store.dapps[origin];
  }

  getDapps() {
    return this.store.dapps;
  }

  removeDapp(origin: string) {
    delete this.store.dapps[origin];
  }

  updateDapp(dapp: DappInfo) {
    this.store.dapps[dapp.origin] = dapp;
  }

  setFavorite(origin: string, isFavorite: boolean) {
    this.store.dapps[origin].isFavorite = isFavorite;
  }

  setConnected(origin: string, isConnected: boolean) {
    this.store.dapps[origin].isConnected = isConnected;
  }

  disconnect(origin: string) {
    this.store.dapps[origin].isConnected = false;
  }

  setChainId(origin: string, chainId: string) {
    this.store.dapps[origin].chainId = chainId;
  }
}
