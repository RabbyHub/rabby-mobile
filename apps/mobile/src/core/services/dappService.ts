import type { CHAINS_ENUM } from '@debank/common';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import type { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';
import { INTERNAL_REQUEST_ORIGIN } from './constant';

export interface DappInfo {
  origin: string;
  info: BasicDappInfo;
  infoUpdateAt?: number;
  isFavorite?: boolean;
  isConnected?: boolean;
  isSigned?: boolean;
  chainId: CHAINS_ENUM;
  lastPath?: string; // 待定
  lastPathTimeAt?: number; //
}

export type DappStore = {
  dapps: Record<string, DappInfo>;
};

export class DappService extends StoreServiceBase<DappStore, 'dapps'> {
  constructor(options?: StorageAdapaterOptions<DappStore>) {
    super(
      'dapps',
      {
        dapps: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
  }

  addDapp(dapp: DappInfo | DappInfo[]) {
    const dapps = Array.isArray(dapp) ? dapp : [dapp];
    dapps.forEach(item => {
      this.store.dapps[item.origin] = item;
    });
    this.store.dapps = { ...this.store.dapps };
  }

  getDapp(dappOrigin: string): DappInfo | undefined {
    return this.store.dapps[dappOrigin];
  }

  getDapps() {
    return this.store.dapps;
  }

  getConnectedDapp(dappOrigin: string) {
    const dapp = this.getDapp(dappOrigin);
    if (dapp?.isConnected) {
      return dapp;
    }
    return null;
  }

  getFavoriteDapps() {
    return Object.values(this.store.dapps).filter(dapp => dapp.isFavorite);
  }

  getConnectedDapps() {
    return Object.values(this.store.dapps).filter(dapp => dapp.isConnected);
  }

  removeDapp(dappOrigin: string) {
    delete this.store.dapps[dappOrigin];
    this.store.dapps = { ...this.store.dapps };
  }

  updateDapp(dapp: DappInfo) {
    this.store.dapps[dapp.origin] = dapp;
    this.store.dapps = { ...this.store.dapps };
  }

  patchDapp(dappOrigin: string, dapp: Partial<DappInfo>) {
    this.store.dapps[dappOrigin] = {
      ...this.store.dapps[dappOrigin],
      ...dapp,
    };
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

  hasPermission(origin: string) {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      return true;
    }
    return !!this.store.dapps[origin]?.isConnected;
  }

  isInternalDapp(origin: string) {
    return origin === INTERNAL_REQUEST_ORIGIN;
  }
}
