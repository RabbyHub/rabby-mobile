import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import { omit, sortBy } from 'lodash';
import { APP_STORE_NAMES } from '../storage/storeConstant';

export interface BrowserHistoryItem {
  origin: string;
  createdAt: number;
}

export type BrowserHistoryStore = {
  browserHistory: {
    [origin: string]: BrowserHistoryItem;
  };
};

/**
 * @deprecated
 */
export class BrowserHistoryService extends StoreServiceBase<
  BrowserHistoryStore,
  'browserHistory'
> {
  constructor(options?: StorageAdapaterOptions<BrowserHistoryStore>) {
    super(
      APP_STORE_NAMES.browserHistory,
      {
        browserHistory: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.mutateStore(draft => {
      draft.browserHistory = Object.entries(draft.browserHistory || {}).reduce(
        (result, [origin, item]) => {
          if (item.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000) {
            result[origin.toLowerCase()] = item;
          }
          return result;
        },
        {},
      );
    });
  }

  setHistory({
    origin: _origin,
    createdAt,
  }: {
    origin: string;
    createdAt?: number;
  }) {
    const origin = _origin.toLowerCase();
    this.mutateStore(draft => {
      draft.browserHistory[origin] = {
        origin,
        createdAt: createdAt || Date.now(),
      };
    });
  }

  getHistoryList() {
    return sortBy(
      Object.values(this.store.browserHistory),
      item => -item.createdAt,
    );
  }

  getHistory(origin: string) {
    return this.store.browserHistory[origin.toLowerCase()];
  }

  hasHistory(origin: string) {
    return !!this.getHistory(origin);
  }

  removeHistory(origin: string) {
    this.mutateStore(draft => {
      draft.browserHistory = omit(draft.browserHistory, [origin.toLowerCase()]);
    });
  }
}
