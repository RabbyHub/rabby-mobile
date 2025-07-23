import { browserService } from '@/core/services';
import { BrowserBookmarkItem } from '@/core/services/browserService';
import { DappInfo } from '@/core/services/dappService';
import { EntityState } from '@/core/utils/createEntryAdapter';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { dappsAtom } from '../useDapps';
import {
  safeGetOrigin,
  safeParseURL,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';

const browserBookmarkAtom = atom<EntityState<BrowserBookmarkItem, string>>({
  ids: [],
  entities: {},
});

export function useBrowserBookmark() {
  const [store, setStore] = useAtom(browserBookmarkAtom);
  const [dapps] = useAtom(dappsAtom);

  const getBookmarkList = useMemoizedFn(() => {
    const entities = browserService.bookmark.selectors.selectEntities();
    const ids = browserService.bookmark.selectors.selectIds();
    setStore({
      ids,
      entities,
    });
  });

  const addBookmark = useMemoizedFn((item: BrowserBookmarkItem) => {
    if (!item || !/^https?:\/\//.test(item.url)) {
      return;
    }
    removeBookmark(item.url);
    browserService.bookmark.addOne(item);
    getBookmarkList();
  });

  const removeBookmark = useMemoizedFn((url: string) => {
    const urlInfo = safeParseURL(url);
    const idsToRemove = store.ids.filter(id => {
      return safeGetOrigin(id) === urlInfo?.origin;
    });
    if (idsToRemove.length) {
      browserService.bookmark.removeMany(idsToRemove);
    }
    getBookmarkList();
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
        return {
          ...dapp,
          ...item,
          icon: dapp?.icon || dapp?.info?.logo_url || undefined,
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
    // updateBookmark,
    getBookmarkList,
  };
}
