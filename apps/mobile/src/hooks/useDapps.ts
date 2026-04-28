import { createDappBySession } from '@/core/apis/dapp';
import { useCallback, useMemo } from 'react';

import { apisDapp } from '@/core/apis';
import type { DappInfo, DappStore } from '@/core/services/dappService';
import type { Account, KeyringAccountWithAlias } from '@/types/account';
import {
  dappService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services/shared';
import { FieldNilable, stringUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useAccounts } from './account';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { resolveDappAccount } from '@/utils/dappAccount';

const dappServiceStore = zCreate<DappStore>(() => {
  return {
    ...dappService.store,
  };
});
dappService.setBeforeSetKV((k, v) => {
  dappServiceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev[k], v as any, {
      strict: true,
    });

    if (!changed) return prev;

    prev[k] = { ...prev[k], ...newVal };
    return { ...prev };
  });
});

function setDapps(valOrFunc: UpdaterOrPartials<Record<string, DappInfo>>) {
  dappServiceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.dapps, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function useDappsValue() {
  return { dapps: dappServiceStore(s => s.dapps) };
}

function isDappConnected(dappOrigin: string) {
  const dapp = dappService.getDapp(dappOrigin);
  return !!dapp?.isConnected;
}

export function useDapps() {
  const dapps = dappServiceStore(s => s.dapps);

  const getDapps = useCallback(() => {
    const res = dappService.getDapps();

    setDapps(res);
    return res;
  }, []);

  const addDapp = useCallback((data: DappInfo | DappInfo[]) => {
    const dataList = Array.isArray(data) ? data : [data];
    dataList.forEach(item => {
      // now we must ensure all dappOrigin has https:// prefix
      item.origin = stringUtils.ensurePrefix(item.info?.id, 'https://');
    });
    const res = dappService.addDapp(data);
    return res;
  }, []);

  const updateFavorite = useCallback((id: string, v: boolean) => {
    if (dappService.getDapp(id)) {
      dappService.updateFavorite(id, v);
    } else {
      dappService.addDapp({
        ...createDappBySession({
          origin: id,
          name: '',
          icon: '',
        }),
        isFavorite: v,
        favoriteAt: v ? Date.now() : null,
      });
    }
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
    dappService.addDapp({
      ...dappService.getDapp(data.origin),
      ...data,
    });
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
      if (!dappService.getDapp(id)) {
        throw new Error('dapp not found');
      }

      dappService.patchDapps({
        [id]: {
          currentAccount,
        },
      });
    },
    [],
  );

  return { setDappCurrentAccount };
}

export const getDappAccount = ({
  dappInfo,
  accounts,
}: {
  dappInfo?: DappInfo;
  accounts: KeyringAccountWithAlias[];
}) => {
  return resolveDappAccount({
    dappInfo,
    accounts,
    transactions: transactionHistoryService.store.transactions,
    fallbackAccount: preferenceService.getFallbackAccount(),
  });
};

export function useGetDappAccount(dappInfo?: DappInfo) {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const account = useMemo(() => {
    return getDappAccount({ dappInfo, accounts });
  }, [accounts, dappInfo]);

  return account;
}
