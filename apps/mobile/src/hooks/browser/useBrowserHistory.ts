import { SectionList } from 'react-native';
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
import {
  safeGetOrigin,
  safeParseURL,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { groupBy, sortBy, unionBy, uniqBy } from 'lodash';
import dayjs from 'dayjs';
import { formatTimestamp } from '@/utils/time';
import { useTranslation } from 'react-i18next';

export const browserHistoryAtom = atom<EntityState<BrowserHistoryItem, string>>(
  {
    ids: [],
    entities: {},
  },
);

export function useBrowserHistory() {
  const [store, setStore] = useAtom(browserHistoryAtom);
  const [dapps] = useAtom(dappsAtom);
  const { bookmarkStore } = useBrowserBookmark();
  const { t } = useTranslation();

  const getBrowserHistoryList = useMemoizedFn(() => {
    const entities = browserService.history.selectors.selectEntities();
    const ids = browserService.history.selectors.selectIds();
    setStore({
      ids,
      entities,
    });
  });

  const setBrowserHistory = useMemoizedFn((item: BrowserHistoryItem) => {
    if (!item || !/^https?:\/\//.test(item.url)) {
      return;
    }
    const historyId = store.ids.find(
      id => safeGetOrigin(id) === safeGetOrigin(item.url),
    );
    try {
      if (historyId) {
        browserService.history.removeOne(historyId);
      }
      browserService.history.addOne(item);
      getBrowserHistoryList();
    } catch (e) {
      console.error(e);
    }
  });

  const removeBrowserHistory = useMemoizedFn((url: string) => {
    browserService.history.removeOne(url);
    getBrowserHistoryList();
  });

  const removeAllBrowserHistory = useMemoizedFn(() => {
    browserService.history.reset();
    getBrowserHistoryList();
  });

  const { list: browserHistoryList, sectionList: browserHistorySectionList } =
    useMemo(() => {
      const list: DappInfo[] = [];
      const dict: Record<number, DappInfo[]> = {};

      store.ids.forEach(key => {
        const item = store.entities[key];
        if (!item || !/^https?:\/\//.test(item.url)) {
          return;
        }
        const origin = urlUtils.canoicalizeDappUrl(item.url).httpOrigin;
        const dapp = dapps[origin];
        const urlInfo = safeParseURL(item.url);
        const isFavorite =
          urlInfo && [urlInfo.origin, urlInfo.origin + '/'].includes(item.url)
            ? !!(
                bookmarkStore.entities[urlInfo.origin] ||
                bookmarkStore.entities[urlInfo.origin + '/']
              )
            : !!bookmarkStore.entities[key];

        const dappInfo = {
          ...dapp,
          ...item,
          name: item?.name || dapp?.name,
          icon: dapp?.icon || dapp?.info?.logo_url || undefined,
          origin,
          isFavorite,
        };

        list.push(dappInfo);
        const timestamp = dayjs(dappInfo.createdAt).startOf('day').valueOf();
        if (dict[timestamp]) {
          dict[timestamp].push(dappInfo);
        } else {
          dict[timestamp] = [dappInfo];
        }
      });

      return {
        list,
        sectionList: sortBy(
          Object.entries(dict).map(([key, value]) => {
            return {
              timestamp: +key,
              title: formatTimestamp(+key, t),
              data: value,
            };
          }),
          item => -item.timestamp,
        ),
      };
    }, [bookmarkStore.entities, dapps, store.entities, store.ids, t]);

  return {
    browserHistoryList,
    browserHistorySectionList,
    setBrowserHistory,
    removeBrowserHistory,
    getBrowserHistoryList,
    removeAllBrowserHistory,
  };
}
