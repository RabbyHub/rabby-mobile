import React, { useCallback, useMemo } from 'react';

import { DappInfo } from '@/core/services/dappService';
import { atom, useAtom } from 'jotai';
import { dappService } from '@/core/services/shared';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useFocusEffect } from '@react-navigation/native';
import { dappsAtom } from '@/core/storage/serviceStoreStub';
import { useOpenDappView } from '@/screens/Dapps/hooks/useDappView';
import { apisDapp } from '@/core/apis';
import { useMount } from 'react-use';
import { syncBasicDappInfo } from '@/core/apis/dapp';

export function useDapps() {
  const [dapps, setDapps] = useAtom(dappsAtom);

  const getDapps = useCallback(() => {
    const res = dappService.getDapps();

    setDapps(res);
    return res;
  }, [setDapps]);

  const addDapp = useCallback((data: DappInfo | DappInfo[]) => {
    const dataList = Array.isArray(data) ? data : [data];
    dataList.forEach(item => {
      // now we must ensure all dappOrigin has https:// prefix
      item.origin = stringUtils.ensurePrefix(item.info.id, 'https://');
    });
    const res = dappService.addDapp(data);
    return res;
  }, []);

  const updateFavorite = useCallback((id: string, v: boolean) => {
    dappService.updateFavorite(id, v);
  }, []);

  const removeDapp = useCallback((id: string) => {
    apisDapp.removeDapp(id);
  }, []);

  const disconnectDapp = useCallback((dappOrigin: string) => {
    apisDapp.disconnect(dappOrigin);
  }, []);

  const isDappConnected = useCallback(
    (dappOrigin: string) => {
      const dapp = dapps[dappOrigin];
      return !!dapp?.isConnected;
    },
    [dapps],
  );

  return {
    dapps,
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
    isDappConnected,
  };
}

export const useDappsHome = () => {
  const [dapps] = useAtom(dappsAtom);
  const { getDapps, addDapp, updateFavorite, removeDapp, disconnectDapp } =
    useDapps();

  const { openedDappItems } = useOpenDappView();

  const favoriteApps = useMemo(() => {
    return Object.values(dapps || {}).filter(item => item.isFavorite);
  }, [dapps]);

  const dappSections = useMemo(() => {
    return [
      {
        key: 'inUse',
        title: '',
        type: 'active',
        data: openedDappItems.map(item => item.maybeDappInfo!).filter(Boolean),
      },

      {
        key: 'favorites',
        title: 'Favorites',
        data: favoriteApps,
      },
    ].filter(item => item.data.length);
  }, [openedDappItems, favoriteApps]);

  useFocusEffect(
    useCallback(() => {
      getDapps();
    }, [getDapps]),
  );

  useMount(async () => {
    const res = getDapps();
    await syncBasicDappInfo(Object.keys(res));
    getDapps();
  });

  return {
    dapps,
    dappSections,
    favoriteApps,
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
  };
};
