import { SectionList } from 'react-native';
import {
  addBrowserHistoryItem,
  getBrowserHistory,
  removeBrowserHistoryItem,
  resetBrowserHistory,
} from '@/core/serviceApi/browser';
import type { BrowserHistoryItem } from '@/core/services/browserService';
import type { DappInfo } from '@/core/services/dappService';
import type { EntityState } from '@/core/utils/createEntryAdapter';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { useDappsValue } from '../useDapps';
import { useBrowserBookmark } from './useBrowserBookmark';
import {
  safeGetOrigin,
  safeParseURL,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { groupBy, sortBy, unionBy, uniqBy } from 'lodash';
import dayjs from 'dayjs';
import { formatTimestamp } from '@/utils/time';
import { useTranslation } from 'react-i18next';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';

// export const browserHistoryAtom = atom<EntityState<BrowserHistoryItem, string>>(
//   {
//     ids: [],
//     entities: {},
//   },
// );
type BrowserHistoryState = EntityState<BrowserHistoryItem, string>;
const browserHistoryStore = zCreate<BrowserHistoryState>(() => ({
  ids: [],
  entities: {},
}));

let browserHistoryReadRevision = 0;

function applyBrowserHistoryStore(
  valOrFunc: UpdaterOrPartials<BrowserHistoryState>,
) {
  browserHistoryStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
}

export const getBrowserHistoryList = async () => {
  const readRevision = ++browserHistoryReadRevision;
  const { entities, ids } = await getBrowserHistory();
  if (readRevision === browserHistoryReadRevision) {
    applyBrowserHistoryStore({
      ids,
      entities,
    });
  }
};

export function resetBrowserHistoryStore() {
  ++browserHistoryReadRevision;
  applyBrowserHistoryStore({
    ids: [],
    entities: {},
  });
}

export function useBrowserHistoryCount() {
  return browserHistoryStore(s => s.ids.length);
}

export function useBrowserHistory() {
  const { ids, entities } = browserHistoryStore(s => s);
  const { dapps } = useDappsValue();
  const { bookmarkStore } = useBrowserBookmark();
  const { t } = useTranslation();

  const setBrowserHistory = useMemoizedFn((item: BrowserHistoryItem) => {
    if (!item || !/^https?:\/\//.test(item.url)) {
      return;
    }
    const historyId = ids.find(
      id => safeGetOrigin(id) === safeGetOrigin(item.url),
    );
    void (async () => {
      try {
        if (historyId) {
          await removeBrowserHistoryItem(historyId);
        }
        await addBrowserHistoryItem(item);
        await getBrowserHistoryList();
      } catch (e) {
        console.error(e);
      }
    })();
  });

  const removeBrowserHistory = useMemoizedFn((url: string) => {
    void removeBrowserHistoryItem(url)
      .then(() => getBrowserHistoryList())
      .catch(console.error);
  });

  const removeAllBrowserHistory = useMemoizedFn(() => {
    void resetBrowserHistory()
      .then(() => getBrowserHistoryList())
      .catch(console.error);
  });

  const { list: browserHistoryList, sectionList: browserHistorySectionList } =
    useMemo(() => {
      const list: DappInfo[] = [];
      const dict: Record<number, DappInfo[]> = {};

      ids.forEach(key => {
        const item = entities[key];
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

        if (!dapp?.isDapp) {
          return;
        }

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
    }, [bookmarkStore.entities, dapps, entities, ids, t]);

  return {
    browserHistoryList,
    browserHistorySectionList,
    setBrowserHistory,
    removeBrowserHistory,
    getBrowserHistoryList,
    removeAllBrowserHistory,
  };
}
