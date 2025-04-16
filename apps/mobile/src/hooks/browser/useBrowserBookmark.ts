import { browserService } from '@/core/services';
import { BrowserBookmarkItem } from '@/core/services/browserService';
import { DappInfo } from '@/core/services/dappService';
import { EntityState } from '@/core/utils/createEntryAdapter';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { dappsAtom } from './useDapps';

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
    browserService.bookmark.addOne(item);
    getBookmarkList();
  });

  const removeBookmark = useMemoizedFn((url: string) => {
    browserService.bookmark.removeOne(url);
    getBookmarkList();
  });

  const updateBookmark = useMemoizedFn((item: BrowserBookmarkItem) => {
    browserService.bookmark.updateOne({
      id: item.url,
      changes: item,
    });
    getBookmarkList();
  });

  const getBookmark = useMemoizedFn(url => {
    return store.entities[url];
  });

  const bookmarkList: DappInfo[] = useMemo(() => {
    return store.ids.map(key => {
      const item = store.entities[key];
      const origin = urlUtils.canoicalizeDappUrl(item.url).httpOrigin;
      const dapp = dapps[origin];
      return {
        ...dapp,
        ...item,
        origin,
        isFavorite: true,
      };
    });
  }, [dapps, store.entities, store.ids]);

  return {
    bookmarkList,
    bookmarkStore: store,
    getBookmark,
    addBookmark,
    removeBookmark,
    updateBookmark,
    getBookmarkList,
  };
}
