import { browserService } from '@/core/services';
import { BrowserHistoryItem } from '@/core/services/browserService';
import { DappInfo } from '@/core/services/dappService';
import { EntityState } from '@/core/utils/createEntryAdapter';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { dappsAtom } from '../useDapps';
import { useBrowserBookmark } from './useBrowserBookmark';

const browserHistoryAtom = atom<EntityState<BrowserHistoryItem, string>>({
  ids: [],
  entities: {},
});

export function useBrowserHistory() {
  const [store, setStore] = useAtom(browserHistoryAtom);
  const [dapps] = useAtom(dappsAtom);
  const { bookmarkStore } = useBrowserBookmark();

  const getBrowserHistoryList = useMemoizedFn(() => {
    const entities = browserService.history.selectors.selectEntities();
    const ids = browserService.history.selectors.selectIds();
    setStore({
      ids,
      entities,
    });
  });

  const setBrowserHistory = useMemoizedFn((item: BrowserHistoryItem) => {
    try {
      const entry = browserService.history.selectors.selectById(item.url);
      if (entry) {
        browserService.history.updateOne({
          id: item.url,
          changes: {
            ...item,
            // createdAt: Date.now(),
          },
        });
      } else {
        browserService.history.addOne(item);
      }
      getBrowserHistoryList();
    } catch (e) {
      console.error(e);
    }
  });

  const removeBrowserHistory = useMemoizedFn((url: string) => {
    browserService.history.removeOne(url);
    getBrowserHistoryList();
  });

  const browserHistoryList: DappInfo[] = useMemo(() => {
    return store.ids
      .map(key => {
        const item = store.entities[key];
        if (!item) {
          return;
        }
        const origin = urlUtils.canoicalizeDappUrl(item.url).httpOrigin;
        const dapp = dapps[origin];
        const isFavorite = !!bookmarkStore.entities[key];
        return {
          ...dapp,
          ...item,
          origin,
          isFavorite,
        };
      })
      .filter(v => !!v);
  }, [bookmarkStore.entities, dapps, store.entities, store.ids]);

  console.log(JSON.stringify(browserHistoryList));

  return {
    browserHistoryList,
    setBrowserHistory,
    removeBrowserHistory,
    getBrowserHistoryList,
  };
}
