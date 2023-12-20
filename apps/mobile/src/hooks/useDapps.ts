import React, { useCallback, useMemo } from 'react';

import { dappService } from '@/core/services';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { atom, useAtom } from 'jotai';

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

  const dappSections = useMemo(() => {
    const list = Object.values(dapps || {});
    if (!list.length) {
      return [];
    }
    const otherList: DappInfo[] = [];
    const favoriteList: DappInfo[] = [];
    list.forEach(item => {
      if (item.isFavorite) {
        favoriteList.push(item);
      } else {
        otherList.push(item);
      }
    });
    return [
      {
        title: '',
        data: otherList,
      },

      {
        title: favoriteList?.length ? 'Favorite' : '',
        data: favoriteList,
      },
    ];
  }, [dapps]);

  React.useEffect(() => {
    getDapps();
  }, [getDapps]);

  return {
    dapps,
    dappSections,
    getDapps,
    addDapp,
    updateFavorite,
    removeDapp,
  };
};
