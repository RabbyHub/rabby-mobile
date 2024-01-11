import React, { useCallback, useMemo } from 'react';

import { DappInfo } from '@rabby-wallet/service-dapp';
import { atom, useAtom } from 'jotai';
import { dappService } from '@/core/services/shared';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useFocusEffect } from '@react-navigation/native';

const dappsAtom = atom<Record<string, DappInfo>>({});

export const useDapps = () => {
  const [dapps, setDapps] = useAtom(dappsAtom);

  const getDapps = useCallback(() => {
    const res = dappService.getDapps();

    setDapps({ ...res });
    return res;
  }, [setDapps]);

  const addDapp = useCallback(
    (data: DappInfo | DappInfo[]) => {
      const dataList = Array.isArray(data) ? data : [data];
      dataList.forEach(item => {
        // now we must ensure all dappOrigin has https:// prefix
        item.origin = stringUtils.ensurePrefix(item.info.id, 'https://');
      });
      const res = dappService.addDapp(data);
      getDapps();
      return res;
    },
    [getDapps],
  );

  const updateFavorite = useCallback(
    (id: string, v: boolean) => {
      dappService.updateFavorite(id, v);
      getDapps();
    },
    [getDapps],
  );

  const removeDapp = useCallback(
    (id: string) => {
      dappService.removeDapp(id);
      getDapps();
    },
    [getDapps],
  );

  const disconnectDapp = useCallback(
    (origin: string) => {
      dappService.disconnect(origin);
      getDapps();
    },
    [getDapps],
  );

  const connectedApps = useMemo(() => {
    return Object.values(dapps || {}).filter(item => item.isConnected);
  }, [dapps]);

  const favoriteApps = useMemo(() => {
    return Object.values(dapps || {}).filter(item => item.isFavorite);
  }, [dapps]);

  // const dappSections = useMemo(() => {
  //   return [
  //     {
  //       title: '',
  //       data: connectedApps,
  //     },

  //     {
  //       title: 'Favorites',
  //       data: favoriteApps,
  //     },
  //   ].filter(item => item.data.length);
  // }, [connectedApps, favoriteApps]);

  // React.useEffect(() => {
  //   getDapps();
  // }, [getDapps]);

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect');
      getDapps();
    }, [getDapps]),
  );

  return {
    dapps,
    favoriteApps,
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
  };
};
