import { useCallback, useMemo } from 'react';

import { dappsAtom } from '@/core/storage/serviceStoreStub';
import { useFocusEffect } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { useBrowserHistory } from './useBrowserHistory';
import { useDapps } from './useDapps';

export const useDappsHome = () => {
  const [dapps] = useAtom(dappsAtom);
  const {
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
    setDapp,
  } = useDapps();

  const {
    browserHistoryList,
    getBrowserHistoryList,
    removeBrowserHistory,
    setBrowserHistory,
  } = useBrowserHistory();

  const favoriteApps = useMemo(() => {
    return Object.values(dapps || {}).filter(item => item.isFavorite);
  }, [dapps]);

  useFocusEffect(
    useCallback(() => {
      getDapps();
    }, [getDapps]),
  );

  useFocusEffect(
    useCallback(() => {
      getBrowserHistoryList();
    }, [getBrowserHistoryList]),
  );

  // useMount(async () => {
  //   const res = getDapps();
  //   await syncBasicDappInfo(Object.keys(res));
  //   getDapps();
  // });

  return {
    dapps,
    favoriteApps,
    setDapp,
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
    browserHistoryList,
    getBrowserHistoryList,
    removeBrowserHistory,
    setBrowserHistory,
  };
};
