import { createDappBySession } from '@/core/apis/dapp';
import { useCallback, useEffect, useMemo } from 'react';

import * as apisDapp from '@/core/apis/dapp';
import type {
  DappInfo,
  DappService,
  DappStore,
} from '@/core/services/dappService';
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
import {
  runWithCoreServices,
  serviceDependency,
  useCoreServiceDependencies,
} from '@/core/serviceApi/serviceDependencies';

const DAPP_SERVICE_DEPENDENCIES = [serviceDependency('dappService')] as const;

const DAPP_ACCOUNT_DEPENDENCIES = [
  serviceDependency('transactionHistoryService'),
] as const;

type DappAccountResolverParams = Omit<
  Parameters<typeof getDappAccount>[0],
  'transactions'
>;

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
    void apisDapp.removeDapp(id).catch(console.error);
  }, []);

  const disconnectDapp = useCallback((dappOrigin: string) => {
    void apisDapp.disconnect(dappOrigin).catch(console.error);
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
  const dependencyState = useCoreServiceDependencies(DAPP_SERVICE_DEPENDENCIES);

  const setDappCurrentAccount = useCallback(
    async (id: DappInfo['origin'], currentAccount: Account) => {
      const applyCurrentAccount = (dappService: DappService) => {
        if (!dappService.getDapp(id)) {
          throw new Error('dapp not found');
        }

        dappService.patchDapps({
          [id]: {
            currentAccount,
          },
        });
      };

      if (dependencyState.status === 'ready') {
        applyCurrentAccount(dependencyState.services.dappService);
        return;
      }

      await runWithCoreServices(DAPP_SERVICE_DEPENDENCIES, services => {
        applyCurrentAccount(services.dappService);
      });
    },
    [dependencyState],
  );

  return { setDappCurrentAccount };
}

export function useDappAccountResolver() {
  const dependencyState = useCoreServiceDependencies(DAPP_ACCOUNT_DEPENDENCIES);

  return useCallback(
    ({ dappInfo, accounts }: DappAccountResolverParams) =>
      getDappAccount({
        dappInfo,
        accounts,
        transactions:
          dependencyState.status === 'ready'
            ? dependencyState.services.transactionHistoryService.store
                .transactions
            : [],
      }),
    [dependencyState],
  );
}

export function useGetDappAccount(dappInfo?: DappInfo) {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const resolveAccount = useDappAccountResolver();

  const account = useMemo(() => {
    return resolveAccount({ dappInfo, accounts });
  }, [accounts, dappInfo, resolveAccount]);

  return account;
}
