import { sortBy } from 'lodash';
import { createDappBySession } from '@/core/apis/dapp';
import { useCallback, useMemo } from 'react';

import { apisDapp } from '@/core/apis';
import { DappInfo } from '@/core/services/dappService';
import { type Account } from '@/core/services/preference';
import {
  dappService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services/shared';
import { FieldNilable, stringUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { KeyringAccountWithAlias, useAccounts, useMyAccounts } from './account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export const dappServiceAtom = atom<FieldNilable<typeof dappService.store>>(
  dappService.store,
);

export const dappsAtom = atom(
  get => get(dappServiceAtom).dapps || {},
  (get, set, newVal: (typeof dappService.store)['dapps']) => {
    const prev = get(dappServiceAtom);
    set(dappServiceAtom, { ...prev, dapps: newVal });
  },
);

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

  const isDappConnected = useCallback(
    (dappOrigin: string) => {
      const dapp = dapps[dappOrigin];
      return !!dapp?.isConnected;
    },
    [dapps],
  );

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
  let res = accounts.find(
    acc =>
      dappInfo?.currentAccount &&
      isSameAddress(acc.address, dappInfo.currentAccount.address) &&
      acc.type === dappInfo.currentAccount.type,
  );
  if (!res) {
    const tx = sortBy(
      transactionHistoryService.store.transactions,
      item => -item.createdAt,
    )[0];
    if (tx) {
      const txAccount = accounts.find(
        acc =>
          isSameAddress(acc.address, tx.address) &&
          (tx.keyringType ? acc.type === tx.keyringType : true),
      );
      if (txAccount) {
        res = txAccount;
      }
      console.log('find by tx', { tx, txAccount });
    }
  }
  return res || accounts[0] || preferenceService.getFallbackAccount();
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
