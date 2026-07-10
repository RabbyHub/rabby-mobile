import type {
  BrowserBookmarkItem,
  BrowserHistoryItem,
  BrowserService,
  BrowserStore,
} from '@/core/services/browserService';
import {
  callCoreService,
  getRegisteredService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type BrowserServiceApiContract = BrowserService;

registerLegacyCoreServiceLoader('browserService');

export const browserServiceApi = createDeferredServiceApi<
  'browserService',
  BrowserServiceApiContract
>('browserService');

const EMPTY_BROWSER_TABS: BrowserStore['browserTabs'] = {
  activeTabId: '',
  tabs: [],
};

const EMPTY_BROWSER_HISTORY: BrowserStore['browserHistory'] = {
  ids: [],
  entities: {},
};

const EMPTY_BROWSER_BOOKMARKS: BrowserStore['browserBookmarks'] = {
  ids: [],
  entities: {},
};

export function getBrowserTabsSnapshot() {
  return (
    getRegisteredService('browserService')?.getBrowserTabs() ||
    EMPTY_BROWSER_TABS
  );
}

export function getBrowserHistorySnapshot() {
  const service = getRegisteredService('browserService');

  if (!service) {
    return EMPTY_BROWSER_HISTORY;
  }

  return {
    ids: service.history.selectors.selectIds(),
    entities: service.history.selectors.selectEntities(),
  };
}

export function getBrowserBookmarkSnapshot() {
  const service = getRegisteredService('browserService');

  if (!service) {
    return EMPTY_BROWSER_BOOKMARKS;
  }

  return {
    ids: service.bookmark.selectors.selectIds(),
    entities: service.bookmark.selectors.selectEntities(),
  };
}

export function getBrowserBookmarkCountSnapshot() {
  return getRegisteredService('browserService')?.bookmark.selectors.selectTotal() || 0;
}

export function getBrowserTabCountSnapshot() {
  return getBrowserTabsSnapshot().tabs.length;
}

export async function addBrowserHistoryItem(item: BrowserHistoryItem) {
  await callCoreService('browserService', service => {
    service.history.addOne(item);
  });
}

export async function removeBrowserHistoryItem(url: string) {
  await callCoreService('browserService', service => {
    service.history.removeOne(url);
  });
}

export async function resetBrowserHistory() {
  await callCoreService('browserService', service => {
    service.history.reset();
  });
}

export async function addBrowserBookmarkItem(item: BrowserBookmarkItem) {
  await callCoreService('browserService', service => {
    service.bookmark.addOne(item);
  });
}

export async function removeBrowserBookmarkItems(ids: string[]) {
  if (!ids.length) {
    return;
  }

  await callCoreService('browserService', service => {
    service.bookmark.removeMany(ids);
  });
}

export async function saveBrowserScreenshot(params: {
  tempUri: string;
  tabId: string;
}) {
  return browserServiceApi.saveScreenshot(params);
}

export async function removeBrowserScreenshot(params: { tabId: string }) {
  return browserServiceApi.removeScreenshot(params);
}
