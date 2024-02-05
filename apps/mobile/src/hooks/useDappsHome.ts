import { useCallback, useMemo } from 'react';

import { useAtom } from 'jotai';
import { useFocusEffect } from '@react-navigation/native';
import { dappsAtom } from '@/core/storage/serviceStoreStub';
import { useOpenDappView } from '@/screens/Dapps/hooks/useDappView';
import useMount from 'react-use/lib/useMount';
import { syncBasicDappInfo } from '@/core/apis/dapp';
import { useDapps } from './useDapps';

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
