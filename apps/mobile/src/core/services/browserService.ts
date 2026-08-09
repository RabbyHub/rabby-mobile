import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import { StoreServiceBase } from '@rabby-wallet/persist-store';
import { cloneDeep, last, sortBy, uniqBy } from 'lodash';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import * as Sentry from '@sentry/react-native';
import {
  createEntityAdapter,
  createEntityTools,
  EntityState,
  EntityTools,
} from '../utils/createEntryAdapter';
import { DappInfo } from './dappService';
import {
  safeGetOrigin,
  safeParseURL,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import RNFS from '@rabby-wallet/react-native-fs';
import { getViewShotFilePath } from '@/utils/browser';

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
  key?: string;
  openTime: number;
  viewShot?: string;
  isTerminate?: boolean;
  isDapp?: boolean;
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
          // activeTabId: emptyTab.id
          // tabs: [emptyTab],
          activeTabId: '',
          tabs: [],
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

    try {
      if (!this.store.config?.isMigrated) {
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
            if (dappInfo?.isFavorite) {
              browserBookmarks.ids.push(dappInfo.origin);
              browserBookmarks.entities[origin] = {
                name: dappInfo.name || dappInfo.info?.name || '',
                url: dappInfo.origin,
                createdAt: dappInfo.favoriteAt || 0,
              };
            }
          });
          Object.entries(historyMap || {}).forEach(([origin, item]) => {
            const dappInfo = dapps[origin];
            if (dapps[origin]) {
              browserHistory.ids.push(origin);
              browserHistory.entities[origin] = {
                name: dappInfo.name || dappInfo.info?.name || '',
                url: dappInfo.origin,
                createdAt: item.createdAt || 0,
              };
            }
          });
        }
        this.mutateStore(draft => {
          draft.config.isMigrated = true;
          if (dapps) {
            draft.browserBookmarks = browserBookmarks;
            draft.browserHistory = browserHistory;
          }
        });
      }
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
    }

    try {
      const browserTabsStore = this.getStoreFieldSnapshot('browserTabs');

      const tabs: Tab[] = [];
      browserTabsStore.tabs.forEach(tab => {
        const res = {
          ...tab,
          initialUrl: tab.url || tab.initialUrl,
          isTerminate: true,
        };
        if (/^https?:\/\//.test(res.initialUrl)) {
          tabs.push(res);
        }
      });
      browserTabsStore.activeTabId =
        tabs.find(tab => tab.id === browserTabsStore.activeTabId)?.id ||
        last(tabs)?.id ||
        '';
      browserTabsStore.tabs = tabs;
      this.mutateStore(draft => {
        draft.browserTabs = browserTabsStore;
      });
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      this.mutateStore(draft => {
        draft.browserTabs = {
          tabs: [],
          activeTabId: '',
        };
      });
    }

    const bookmarkAdapter = createEntityAdapter<BrowserBookmarkItem>({
      selectId: item => item?.url,
      sortComparer: (a, b) => (a?.createdAt > b?.createdAt ? -1 : 1),
      onStateChange: newState => {
        this.mutateStore(draft => {
          draft.browserBookmarks = newState;
        });
      },
    });

    const historyAdapter = createEntityAdapter<BrowserHistoryItem>({
      selectId: item => item?.url,
      sortComparer: (a, b) => (a?.createdAt > b?.createdAt ? -1 : 1),
      onStateChange: newState => {
        this.mutateStore(draft => {
          draft.browserHistory = newState;
        });
      },
    });

    try {
      const res: EntityState<BrowserBookmarkItem, string> = {
        ids: [],
        entities: {},
      };

      const ids = uniqBy(
        this.store.browserBookmarks.ids.map(url => {
          const urlInfo = safeParseURL(url);
          return urlInfo && urlInfo.origin === url ? url + '/' : url;
        }),
        item => safeGetOrigin(item),
      );

      ids.forEach(key => {
        const urlInfo = safeParseURL(key);
        const item =
          urlInfo && urlInfo.origin + '/' === key
            ? this.store.browserBookmarks.entities[key] ||
              this.store.browserBookmarks.entities[urlInfo.origin]
            : this.store.browserBookmarks.entities[key];
        if (item && /^https?:\/\//.test(item.url)) {
          res.ids.push(key);
          res.entities[key] = {
            ...item,
            url: key,
          };
        }
      });
      this.mutateStore(draft => {
        draft.browserBookmarks = res;
      });
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      this.mutateStore(draft => {
        draft.browserBookmarks = {
          ids: [],
          entities: {},
        };
      });
    }

    try {
      const res: EntityState<BrowserHistoryItem, string> = {
        ids: [],
        entities: {},
      };

      uniqBy(this.store.browserHistory.ids, item =>
        safeGetOrigin(item),
      ).forEach(key => {
        const item = this.store.browserHistory.entities[key];
        if (
          item &&
          /^https?:\/\//.test(item.url) &&
          Date.now() - (item.createdAt || 0) < 30 * 24 * 60 * 60 * 1000
        ) {
          res.ids.push(key);
          res.entities[key] = {
            ...item,
          };
        }
      });
      this.mutateStore(draft => {
        draft.browserHistory = res;
      });
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      this.mutateStore(draft => {
        draft.browserHistory = {
          ids: [],
          entities: {},
        };
      });
    }

    try {
      this.bookmark = createEntityTools(
        bookmarkAdapter,
        this.getStoreFieldSnapshot('browserBookmarks'),
      );
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      this.mutateStore(draft => {
        draft.browserBookmarks = {
          ids: [],
          entities: {},
        };
      });
      this.bookmark = createEntityTools(
        bookmarkAdapter,
        this.getStoreFieldSnapshot('browserBookmarks'),
      );
    }

    try {
      this.history = createEntityTools(
        historyAdapter,
        this.getStoreFieldSnapshot('browserHistory'),
      );
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
      this.mutateStore(draft => {
        draft.browserHistory = {
          ids: [],
          entities: {},
        };
      });
      this.history = createEntityTools(
        historyAdapter,
        this.getStoreFieldSnapshot('browserHistory'),
      );
    }
  }

  clearBrowserData = () => {
    this.history.reset();
    this.mutateStore(draft => {
      draft.browserTabs = {
        activeTabId: '',
        tabs: [],
      };
    });
  };

  updateBrowserTabs = (payload: Partial<BrowserStore['browserTabs']>) => {
    this.mutateStore(draft => {
      Object.assign(draft.browserTabs, payload);
    });
  };

  getBrowserTabs = () => {
    return this.getStoreFieldSnapshot('browserTabs');
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
    this.history.upsertOne({
      url: origin,
      createdAt: createdAt || Date.now(),
    });
  }

  /**
   * @deprecated
   * @param param0
   */
  getHistoryList() {
    return sortBy(this.history.selectors.selectAll(), item => -item.createdAt);
  }

  /**
   * @deprecated
   * @param param0
   */
  getHistory(origin: string) {
    return this.history.selectors.selectById(origin.toLowerCase());
  }

  /**
   * @deprecated
   * @param param0
   */
  hasHistory(origin: string) {
    return !!this.getHistory(origin);
  }

  async saveScreenshot({ tempUri, tabId }: { tempUri: string; tabId: string }) {
    const fileName = `screenshot-${tabId}-${Date.now()}.jpg`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await this.removeScreenshot({ tabId });
    try {
      await RNFS.persistFile(tempUri, filePath, {
        mode: 'copy',
        overwrite: true,
        ensureParent: true,
      });
      // return filePath?.startsWith('file://') ? filePath : `file://${filePath}`;
      return fileName;
    } catch (e) {
      console.error(e);
    }
  }

  async removeScreenshot({ tabId }: { tabId: string }) {
    const tab = this.store.browserTabs.tabs.find(item => item.id === tabId);
    const filePath = tab?.viewShot ? getViewShotFilePath(tab?.viewShot) : '';
    if (!filePath) {
      return;
    }
    try {
      if (await RNFS.exists(filePath)) {
        await RNFS.unlink(filePath);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}
