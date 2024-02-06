import { useCallback } from 'react';

import { DappInfo } from '@/core/services/dappService';
import { useAtom } from 'jotai';
import { dappService } from '@/core/services/shared';
import { stringUtils } from '@rabby-wallet/base-utils';
import { dappsAtom } from '@/core/storage/serviceStoreStub';
import { apisDapp } from '@/core/apis';

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
