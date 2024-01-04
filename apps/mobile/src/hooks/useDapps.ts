import React, { useCallback, useMemo } from 'react';

import { DappInfo } from '@rabby-wallet/service-dapp';
import { atom, useAtom } from 'jotai';
import { dappService } from '@/core/services/shared';
import { stringUtils } from '@rabby-wallet/base-utils';

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
        item.info.id = stringUtils.ensurePrefix(item.info.id, 'https://');
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
        title: 'Favorites',
        data: favoriteList,
      },
    ].filter(item => item.data.length);
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
