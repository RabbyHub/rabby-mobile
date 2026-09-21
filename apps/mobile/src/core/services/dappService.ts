import type { CHAINS_ENUM } from '@/constant/chains';
import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import type { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import type { Account } from '@/types/account';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { cloneDeep, omit } from 'lodash';
import * as Sentry from '@sentry/react-native';

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
  isSkipRemind?: boolean;
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

    this.mutateStore(draft => {
      Object.keys(draft.dapps).forEach(origin => {
        const dapp = draft.dapps[origin];
        if (dapp && (!dapp.origin || !/^https?:\/\//.test(dapp.origin))) {
          dapp.origin = origin;
        }
      });
    });

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
    this.mutateStore(draft => {
      dapps.forEach(item => {
        draft.dapps[item.origin] = item;
      });
    });
  }

  getDapp(dappOrigin: string): DappInfo | undefined {
    return cloneDeep(this.store.dapps[dappOrigin]) as DappInfo | undefined;
  }

  getDapps() {
    return this.getStoreFieldSnapshot('dapps');
  }

  getConnectedDapp(dappOrigin: string) {
    const dapp = this.getDapp(dappOrigin);
    if (dapp?.isConnected) {
      return dapp;
    }
    return null;
  }

  getFavoriteDapps() {
    return cloneDeep(
      Object.values(this.store.dapps).filter(dapp => dapp.isFavorite),
    );
  }

  getConnectedDapps() {
    return cloneDeep(
      Object.values(this.store.dapps).filter(dapp => dapp.isConnected),
    );
  }

  removeDapp(dappOrigin: string) {
    this.mutateStore(draft => {
      delete draft.dapps[dappOrigin];
    });
  }

  updateDapp(dapp: DappInfo) {
    if (!dapp?.origin || !/^https?:\/\//.test(dapp.origin)) {
      Sentry.captureException(new Error('Invalid dapp origin'), {
        tags: {
          scene: 'dappService',
        },
        extra: {
          dapp: omit(dapp, 'currentAccount'),
        },
      });
      return;
    }
    this.mutateStore(draft => {
      draft.dapps[dapp.origin] = {
        ...draft.dapps[dapp.origin],
        ...dapp,
      };
    });
  }

  // patchDapp(dappOrigin: string, dapp: Partial<DappInfo>) {
  //   this.store.dapps[dappOrigin] = {
  //     ...this.store.dapps[dappOrigin],
  //     ...dapp,
  //   };
  //   this.store.dapps = { ...this.store.dapps };
  // }

  patchDapps(dapps: Record<string, Partial<DappInfo>>) {
    this.mutateStore(draft => {
      Object.keys(dapps).forEach(origin => {
        draft.dapps[origin] = {
          ...draft.dapps[origin],
          ...dapps[origin],
          origin,
        };
      });
    });
  }

  updateFavorite(origin: string, isFavorite: boolean) {
    if (!this.store.dapps[origin]) {
      return;
    }
    this.mutateStore(draft => {
      draft.dapps[origin] = {
        ...draft.dapps[origin],
        isFavorite,
        favoriteAt: isFavorite ? Date.now() : null,
      };
    });
  }

  disconnect(origin: string) {
    if (!this.store.dapps[origin]) {
      return;
    }
    this.mutateStore(draft => {
      draft.dapps[origin].isConnected = false;
    });
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
