import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import { omit, sortBy } from 'lodash';
import { APP_STORE_NAMES } from '../storage/storeConstant';

export interface BrowserHistoryItem {
  url: string;
  title: string;
  icon?: string;
  createdAt: number;
  tabId?: string;
}

export interface BrowserBookmarkItem {
  url: string;
  title: string;
  icon?: string;
  createdAt: number;
  tabId?: string;
}

export type BrowserStore = {
  browserHistory: {
    [origin: string]: BrowserHistoryItem;
  };
  browserBookmarks: {
    ids: string[];
    entities: Record;
  };
};

export class BrowserService extends StoreServiceBase<BrowserStore, 'browser'> {
  constructor(options?: StorageAdapaterOptions<BrowserStore>) {
    super(
      APP_STORE_NAMES.browser,
      {
        browserHistory: {},
        browserBookmarks: {},
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.store.browserHistory = Object.entries(
      this.store.browserHistory || {},
    ).reduce((result, [origin, item]) => {
      if (item.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000) {
        result[origin.toLowerCase()] = item;
      }
      return result;
    }, {});
  }

  setHistory({
    origin: _origin,
    createdAt,
  }: {
    origin: string;
    createdAt?: number;
  }) {
    const origin = _origin.toLowerCase();
    this.store.browserHistory = {
      ...this.store.browserHistory,
      [origin]: {
        origin,
        createdAt: createdAt || Date.now(),
      },
    };
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
    this.store.browserHistory = omit(this.store.browserHistory, [
      origin.toLocaleLowerCase(),
    ]);
  }
}
