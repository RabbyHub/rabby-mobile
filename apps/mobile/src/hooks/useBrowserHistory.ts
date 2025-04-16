import { browserService } from '@/core/services';
import { BrowserHistoryItem } from '@/core/services/browserService';
import { DappInfo } from '@/core/services/dappService';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useBrowserBookmark } from './useBrowserBookmark';
import { dappsAtom } from './useDapps';

const browserHistoryAtom = atom<DappInfo[]>([]);

export function useBrowserHistory() {
  const [historyStore, setHistoryStore] = useAtom(browserHistoryAtom);
  const [dapps] = useAtom(dappsAtom);
  const { bookmarkStore } = useBrowserBookmark();

  const getBrowserHistoryList = useMemoizedFn(() => {
    const list = browserService.history.selectors.selectAll();

    setHistoryStore(
      list.map(item => {
        const origin = urlUtils.canoicalizeDappUrl(item.url).httpOrigin;
        const dapp = dapps[origin];
        return {
          ...dapp,
          ...item,
          origin,
          isFavorite: !!bookmarkStore.entities[origin],
        };
      }),
    );
    return list;
  });

  const setBrowserHistory = useMemoizedFn((item: BrowserHistoryItem) => {
    try {
      const entry = browserService.history.selectors.selectById(item.url);
      if (entry) {
        browserService.history.updateOne({
          id: item.url,
          changes: {
            ...item,
            createdAt: Date.now(),
          },
        });
      } else {
        console.log('add');
        const newState = browserService.history.addOne(item);
        console.log('newState', newState);
      }
      console.log(browserService.store.browserHistory);
      getBrowserHistoryList();
    } catch (e) {
      console.error(e);
    }
  });

  const removeBrowserHistory = useMemoizedFn((url: string) => {
    browserService.history.removeOne(url);
    getBrowserHistoryList();
  });

  return {
    browserHistoryList: historyStore,
    setBrowserHistory,
    removeBrowserHistory,
    getBrowserHistoryList,
  };
}
