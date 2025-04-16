import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import { sortBy } from 'lodash';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import {
  createEntityAdapter,
  createEntityTools,
  EntityState,
  EntityTools,
} from '../utils/createEntryAdapter';

export interface BrowserHistoryItem {
  url: string;
  name?: string;
  icon?: string;
  createdAt: number;
  tabId?: string;
}

export interface BrowserBookmarkItem {
  url: string;
  name?: string;
  icon?: string;
  createdAt: number;
  tabId?: string;
}

export type BrowserStore = {
  browserHistory: EntityState<BrowserHistoryItem, string>;
  browserBookmarks: EntityState<BrowserBookmarkItem, string>;
};

export class BrowserService extends StoreServiceBase<BrowserStore, 'browser'> {
  bookmark: EntityTools<BrowserBookmarkItem, string>;
  history: EntityTools<BrowserHistoryItem, string>;

  constructor(options?: StorageAdapaterOptions<BrowserStore>) {
    super(
      APP_STORE_NAMES.browser,
      {
        browserHistory: {
          ids: [],
          entities: {},
        },
        browserBookmarks: {
          ids: [],
          entities: {},
        },
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    const bookmarkAdapter = createEntityAdapter<BrowserBookmarkItem>({
      selectId: item => item.url,
      sortComparer: (a, b) => (a?.createdAt > b?.createdAt ? -1 : 1),
      onStateChange: newState => {
        this.store.browserBookmarks = newState;
      },
    });

    this.bookmark = createEntityTools(
      bookmarkAdapter,
      this.store.browserBookmarks,
    );

    const historyAdapter = createEntityAdapter<BrowserHistoryItem>({
      selectId: item => item.url,
      sortComparer: (a, b) => (a?.createdAt > b?.createdAt ? -1 : 1),
      onStateChange: newState => {
        this.store.browserHistory = newState;
      },
    });

    this.history = createEntityTools(historyAdapter, this.store.browserHistory);
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
}
