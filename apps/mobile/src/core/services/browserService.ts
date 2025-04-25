import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import { entries, sortBy } from 'lodash';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import {
  createEntityAdapter,
  createEntityTools,
  EntityState,
  EntityTools,
} from '../utils/createEntryAdapter';
import { DappInfo } from './dappService';

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

export type Tab = {
  url: string;
  initialUrl: string;
  id: string;
  openTime: number;
  viewShot?: string;
  isTerminate?: boolean;
};

export const emptyTab: Tab = {
  id: 'EMPTY_TAB_ID',
  url: '',
  initialUrl: '',
  openTime: 0,
};

export type BrowserStore = {
  browserHistory: EntityState<BrowserHistoryItem, string>;
  browserBookmarks: EntityState<BrowserBookmarkItem, string>;
  browserTabs: {
    activeTabId: string;
    tabs: Tab[];
  };
  config: {
    isMigrated?: boolean;
  };
};

export class BrowserService extends StoreServiceBase<BrowserStore, 'browser'> {
  bookmark: EntityTools<BrowserBookmarkItem, string>;
  history: EntityTools<BrowserHistoryItem, string>;
  userAgent?: string;

  constructor(options?: StorageAdapaterOptions<BrowserStore>) {
    super(
      APP_STORE_NAMES.browser,
      {
        browserTabs: {
          activeTabId: emptyTab.id,
          tabs: [emptyTab],
        },
        browserHistory: {
          ids: [],
          entities: {},
        },
        browserBookmarks: {
          ids: [],
          entities: {},
        },
        config: {
          isMigrated: false,
        },
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    if (!this.store.config?.isMigrated) {
      this.store.config = {
        ...this.store.config,
        isMigrated: true,
      };
      const dappsStore = options?.storageAdapter?.getItem(
        APP_STORE_NAMES.dapps,
      );
      const dapps = dappsStore?.dapps as Record<string, DappInfo> | null;
      const historyStore = options?.storageAdapter?.getItem(
        APP_STORE_NAMES.browserHistory,
      );
      const historyMap = historyStore?.browserHistory as Record<
        string,
        {
          origin: string;
          createdAt: number;
        }
      > | null;
      const browserBookmarks: BrowserStore['browserBookmarks'] = {
        ids: [],
        entities: {},
      };
      const browserHistory: BrowserStore['browserHistory'] = {
        ids: [],
        entities: {},
      };

      if (dapps) {
        Object.entries(dapps).forEach(([origin, dappInfo]) => {
          if (dappInfo.isFavorite) {
            browserBookmarks.ids.push(dappInfo.origin);
            browserBookmarks.entities[origin] = {
              name: dappInfo.name,
              url: dappInfo.origin,
              createdAt: dappInfo.favoriteAt || 0,
            };
          }
        });
        this.store.browserBookmarks = browserBookmarks;
        Object.entries(historyMap || {}).forEach(([origin, item]) => {
          const dappInfo = dapps[origin];
          if (dapps[origin]) {
            browserHistory.ids.push(origin);
            browserHistory.entities[origin] = {
              name: dappInfo.name,
              url: dappInfo.origin,
              createdAt: item.createdAt || 0,
            };
          }
        });
        this.store.browserHistory = browserHistory;
      }
    }

    const browserTabsStore = {
      ...this.store.browserTabs,
    };

    let isValidActiveTabId = false;
    let hasEmpty = false;
    browserTabsStore.tabs = browserTabsStore.tabs.map(tab => {
      const isActive = tab.id === browserTabsStore.activeTabId;
      if (isActive) {
        isValidActiveTabId = true;
      }
      if (tab.id === emptyTab.id) {
        hasEmpty = true;
      }
      return {
        ...tab,
        initialUrl: tab.url || tab.initialUrl,
        isTerminate: !isActive,
      };
    });
    if (!isValidActiveTabId) {
      browserTabsStore.activeTabId = emptyTab.id;
    }
    if (!hasEmpty) {
      browserTabsStore.tabs = [emptyTab, ...browserTabsStore.tabs];
    }
    this.store.browserTabs = browserTabsStore;

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

    const res: EntityState<BrowserHistoryItem, string> = {
      ids: [],
      entities: {},
    };

    this.store.browserHistory.ids.forEach(key => {
      const item = this.store.browserHistory.entities[key];
      if (Date.now() - (item.createdAt || 0) < 30 * 24 * 60 * 60 * 1000) {
        res.ids.push(key);
        res.entities[key] = item;
      }
    });
    this.store.browserHistory = res;

    this.history = createEntityTools(historyAdapter, this.store.browserHistory);
  }

  getDefaultUserAgent = () => {
    return this.userAgent;
  };

  setDefaultUserAgent = (ua: string) => {
    this.userAgent = ua;
  };

  updateBrowserTabs = (payload: Partial<BrowserStore['browserTabs']>) => {
    this.store.browserTabs = {
      ...this.store.browserTabs,
      ...payload,
    };
  };

  getBrowserTabs = () => {
    return this.store.browserTabs;
  };

  /**
   * @deprecated
   * @param param0
   */
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

  /**
   * @deprecated
   * @param param0
   */
  getHistoryList() {
    return sortBy(
      Object.values(this.store.browserHistory),
      item => -item.createdAt,
    );
  }

  /**
   * @deprecated
   * @param param0
   */
  getHistory(origin: string) {
    return this.store.browserHistory[origin.toLowerCase()];
  }

  /**
   * @deprecated
   * @param param0
   */
  hasHistory(origin: string) {
    return !!this.getHistory(origin);
  }
}
