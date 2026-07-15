import {
  addBrowserBookmarkItem,
  getBrowserBookmarks,
  removeBrowserBookmarkItems,
} from '@/core/serviceApi/browser';
import type { BrowserBookmarkItem } from '@/core/services/browserService';
import type { DappInfo } from '@/core/services/dappService';
import type { EntityState } from '@/core/utils/createEntryAdapter';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { useMemo } from 'react';
import { useDappsValue } from '../useDapps';
import {
  safeGetOrigin,
  safeParseURL,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';

type zBrowserBookmarkState = EntityState<BrowserBookmarkItem, string> & {
  hydrated: boolean;
};
const zBrowserBookmarkStore = zCreate<zBrowserBookmarkState>(() => ({
  ids: [],
  entities: {},
  hydrated: false,
}));

let browserBookmarkReadRevision = 0;

function applyBrowserBookmarkStore(
  valOrFunc: UpdaterOrPartials<zBrowserBookmarkState>,
) {
  zBrowserBookmarkStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
}

export const getBookmarkList = async () => {
  const readRevision = ++browserBookmarkReadRevision;
  const { entities, ids } = await getBrowserBookmarks();
  if (readRevision === browserBookmarkReadRevision) {
    applyBrowserBookmarkStore({
      ids,
      entities,
      hydrated: true,
    });
  }
};

export function useBrowserBookmark() {
  const store = zBrowserBookmarkStore(s => s);
  const { dapps } = useDappsValue();

  const addBookmark = useMemoizedFn((item: BrowserBookmarkItem) => {
    if (!item || !/^https?:\/\//.test(item.url)) {
      return;
    }
    void (async () => {
      try {
        const urlInfo = safeParseURL(item.url);
        const idsToRemove = store.ids.filter(id => {
          return safeGetOrigin(id) === urlInfo?.origin;
        });
        await removeBrowserBookmarkItems(idsToRemove);
        await addBrowserBookmarkItem(item);
        await getBookmarkList();
      } catch (e) {
        console.error(e);
      }
    })();
  });

  const removeBookmark = useMemoizedFn((url: string) => {
    const urlInfo = safeParseURL(url);
    const idsToRemove = store.ids.filter(id => {
      return safeGetOrigin(id) === urlInfo?.origin;
    });
    void removeBrowserBookmarkItems(idsToRemove)
      .then(() => getBookmarkList())
      .catch(console.error);
  });

  // const updateBookmark = useMemoizedFn((item: BrowserBookmarkItem) => {
  //   browserService.bookmark.updateOne({
  //     id: item.url,
  //     changes: item,
  //   });
  //   getBookmarkList();
  // });

  const getBookmark = useMemoizedFn(url => {
    const urlInfo = safeParseURL(url);
    const id = store.ids.find(i => safeGetOrigin(i) === urlInfo?.origin);
    if (id) {
      return store.entities[id];
    }
  });

  const bookmarkList: DappInfo[] = useMemo(() => {
    return store.ids
      .map(key => {
        const item = store.entities[key];
        if (!item || !/^https?:\/\//.test(item.url)) {
          return;
        }
        const origin = urlUtils.canoicalizeDappUrl(item.url).httpOrigin;
        const dapp = dapps[origin];
        if (!dapp?.isDapp) {
          return null;
        }
        return {
          ...dapp,
          ...item,
          icon: dapp?.icon || dapp?.info?.logo_url || undefined,
          name: item.name || dapp.name,
          origin,
          isFavorite: true,
        };
      })
      .filter(item => !!item);
  }, [dapps, store.entities, store.ids]);

  return {
    bookmarkList,
    bookmarkStore: store,
    getBookmark,
    addBookmark,
    removeBookmark,
  };
}

export const useDappsBadge = () => {
  const { bookmarkList } = useBrowserBookmark();

  const badgeList = useMemo(() => {
    const list = bookmarkList
      .filter(e => e.isFavorite)
      .sort((a, b) => (a as any).createdAt - (b as any).createdAt);
    if (list.length < 3) {
      return list;
    }
    return list.slice(list.length - 3);
  }, [bookmarkList]);

  return badgeList;
};
