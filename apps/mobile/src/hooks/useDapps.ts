import React, { useCallback, useMemo } from 'react';

import { DappInfo } from '@rabby-wallet/service-dapp';
import { atom, useAtom } from 'jotai';
import { dappService } from '@/core/services/shared';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useFocusEffect } from '@react-navigation/native';
import { dappsAtom } from '@/core/storage/serviceStoreStub';
import { useOpenDappView } from '@/screens/Dapps/hooks/useDappView';

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
    dappService.removeDapp(id);
  }, []);

  const disconnectDapp = useCallback((origin: string) => {
    dappService.disconnect(origin);
  }, []);

  const isDappConnected = useCallback(
    (origin: string) => {
      const dapp = dapps[origin];
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

  const { openedDapps } = useOpenDappView();

  const favoriteApps = useMemo(() => {
    return Object.values(dapps || {}).filter(item => item.isFavorite);
  }, [dapps]);

  const dappSections = useMemo(() => {
    return [
      {
        key: 'inUse',
        title: 'In Use',
        data: openedDapps,
      },

      {
        key: 'favorites',
        title: 'Favorites',
        data: favoriteApps,
      },
    ].filter(item => item.data.length);
  }, [openedDapps, favoriteApps]);

  useFocusEffect(
    useCallback(() => {
      console.log('[useDapps] useFocusEffect');
      getDapps();
    }, [getDapps]),
  );

  return {
    dapps,
    dappSections,
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
  };
};
