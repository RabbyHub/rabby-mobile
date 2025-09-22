import type { CHAINS_ENUM } from '@/constant/chains';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import type { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { Account } from './preference';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

export interface DappInfo {
  origin: string;
  icon?: string;
  name: string;
  url?: string;
  info?: BasicDappInfo;
  infoUpdateAt?: number;
  isFavorite?: boolean;
  isConnected?: boolean;
  isSigned?: boolean;
  chainId: CHAINS_ENUM;
  lastPath?: string; // 待定
  lastPathTimeAt?: number; //
  currentAccount?: Account | null;
  favoriteAt?: number | null;
  isDapp?: boolean;
}

export type DappStore = {
  dapps: Record<string, DappInfo>;
};

export class DappService extends StoreServiceBase<
  DappStore,
  APP_STORE_NAMES.dapps
> {
  constructor(options?: StorageAdapaterOptions<DappStore>) {
    super(
      APP_STORE_NAMES.dapps,
      {
        dapps: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.patchDapps(
      ['https://www.google.com', 'https://x.com', 'https://github.com'].reduce(
        (result, key) => {
          result[key] = {
            isDapp: false,
          };
          return result;
        },
        {},
      ),
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

  // patchDapp(dappOrigin: string, dapp: Partial<DappInfo>) {
  //   this.store.dapps[dappOrigin] = {
  //     ...this.store.dapps[dappOrigin],
  //     ...dapp,
  //   };
  //   this.store.dapps = { ...this.store.dapps };
  // }

  patchDapps(dapps: Record<string, Partial<DappInfo>>) {
    Object.keys(dapps).forEach(origin => {
      this.store.dapps[origin] = {
        ...this.store.dapps[origin],
        ...dapps[origin],
      };
    });
    this.store.dapps = { ...this.store.dapps };
  }

  updateFavorite(origin: string, isFavorite: boolean) {
    this.store.dapps[origin] = {
      ...this.store.dapps[origin],
      isFavorite,
      favoriteAt: isFavorite ? Date.now() : null,
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
    return !!this.store.dapps[safeGetOrigin(origin)]?.isConnected;
  }

  isInternalDapp(origin: string) {
    return origin === INTERNAL_REQUEST_ORIGIN;
  }
}
