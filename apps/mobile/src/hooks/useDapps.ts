import { createDappBySession } from '@/core/apis/dapp';
import { useCallback, useEffect, useMemo } from 'react';

import * as apisDapp from '@/core/apis/dapp';
import type { DappInfo, DappStore } from '@/core/services/dappService';
import type { Account, KeyringAccountWithAlias } from '@/types/account';
import {
  bindDappStoreListener,
  dappServiceApi,
  getDappSnapshot,
  getDappsSnapshot,
} from '@/core/serviceApi/dapp';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useAccounts } from './account';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import { getDappAccount } from '@/core/utils/dappAccount';

export { getDappAccount } from '@/core/utils/dappAccount';

const dappServiceStore = zCreate<DappStore>(() => ({ dapps: {} }));

let dappStoreBindingPromise: Promise<void> | null = null;
let disposeDappStoreBinding: (() => void) | null = null;

function applyDappStoreUpdate<K extends keyof DappStore>(
  k: K,
  v: DappStore[K],
) {
  dappServiceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev[k], v as any, {
      strict: true,
    });

    if (!changed) return prev;

    prev[k] = { ...prev[k], ...newVal };
    return { ...prev };
  });
}

function ensureDappStoreBinding() {
  if (disposeDappStoreBinding || dappStoreBindingPromise) {
    return;
  }

  dappStoreBindingPromise = bindDappStoreListener((k, v) => {
    applyDappStoreUpdate(k, v as DappStore[typeof k]);
  })
    .then(dispose => {
      disposeDappStoreBinding = dispose;
    })
    .catch(error => {
      dappStoreBindingPromise = null;
      console.error(error);
    });
}

function setDapps(valOrFunc: UpdaterOrPartials<Record<string, DappInfo>>) {
  dappServiceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.dapps, valOrFunc, {
      strict: false,
    });

    return {
      ...prev,
      dapps: newVal,
    };
  });
}

export function useDappsValue() {
  useEffect(() => {
    ensureDappStoreBinding();
  }, []);

  return { dapps: dappServiceStore(s => s.dapps) };
}

function isDappConnected(dappOrigin: string) {
  const dapp = getDappSnapshot(dappOrigin);
  return !!dapp?.isConnected;
}

export function useDapps() {
  useEffect(() => {
    ensureDappStoreBinding();
  }, []);

  const dapps = dappServiceStore(s => s.dapps);

  const getDapps = useCallback(() => {
    const res = getDappsSnapshot();

    setDapps(res);
    ensureDappStoreBinding();
    return res;
  }, []);

  const addDapp = useCallback((data: DappInfo | DappInfo[]) => {
    const dataList = Array.isArray(data) ? data : [data];
    dataList.forEach(item => {
      // now we must ensure all dappOrigin has https:// prefix
      item.origin = stringUtils.ensurePrefix(item.info?.id, 'https://');
    });
    void dappServiceApi.addDapp(data).catch(console.error);
  }, []);

  /**
   * @deprecated
   */
  const updateFavorite = useCallback((id: string, v: boolean) => {
    void (async () => {
      if (await dappServiceApi.getDapp(id)) {
        await dappServiceApi.updateFavorite(id, v);
      } else {
        await dappServiceApi.addDapp({
          ...createDappBySession({
            origin: id,
            name: '',
            icon: '',
          }),
          isFavorite: v,
          favoriteAt: v ? Date.now() : null,
        });
      }
    })().catch(console.error);
  }, []);

  const removeDapp = useCallback((id: string) => {
    apisDapp.removeDapp(id);
  }, []);

  const disconnectDapp = useCallback((dappOrigin: string) => {
    apisDapp.disconnect(dappOrigin);
  }, []);

  // const isDappConnected = useCallback(
  //   (dappOrigin: string) => {
  //     const dapp = dapps[dappOrigin];
  //     return !!dapp?.isConnected;
  //   },
  //   [dapps],
  // );

  const setDapp = useMemoizedFn((data: DappInfo) => {
    void (async () => {
      await dappServiceApi.addDapp({
        ...(await dappServiceApi.getDapp(data.origin)),
        ...data,
      });
    })().catch(console.error);
  });

  return {
    dapps,
    getDapps,
    setDapp,
    addDapp,
    updateFavorite,
    removeDapp,
    disconnectDapp,
    isDappConnected,
  };
}

export function useDappCurrentAccount() {
  const setDappCurrentAccount = useCallback(
    (id: DappInfo['origin'], currentAccount: Account) => {
      void (async () => {
        if (!(await dappServiceApi.getDapp(id))) {
          throw new Error('dapp not found');
        }

        await dappServiceApi.patchDapps({
          [id]: {
            currentAccount,
          },
        });
      })().catch(console.error);
    },
    [],
  );

  return { setDappCurrentAccount };
}

export function useGetDappAccount(dappInfo?: DappInfo) {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const account = useMemo(() => {
    return getDappAccount({ dappInfo, accounts });
  }, [accounts, dappInfo]);

  return account;
}
