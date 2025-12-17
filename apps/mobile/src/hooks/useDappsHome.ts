import { sortBy } from 'lodash';
import { useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { useDappsValue, useDapps } from './useDapps';
import { useBrowserHistory } from './browser/useBrowserHistory';

export const useDappsHome = () => {
  const { dapps } = useDappsValue();
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
    return sortBy(
      Object.values(dapps || {}).filter(item => item.isFavorite),
      dapp => {
        return -(dapp.favoriteAt || 0);
      },
    );
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
