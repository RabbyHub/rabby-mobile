import { atomByMMKV } from '@/core/storage/mmkv';

import type { Account } from '@/core/services/preference';
import { useAccounts } from './account';
import { useCallback, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';

export type AccountSwitcherState = {
  /**
   * @default {true}
   */
  collapsed: boolean;
};

type AccountSwitchersStates = {
  Send: AccountSwitcherState;
  Swap: AccountSwitcherState;
  Bridge: AccountSwitcherState;
};
export type AccountSwitcherScene = keyof AccountSwitchersStates;

type SceneAccounts = Record<
  AccountSwitcherScene,
  {
    currentAccount: Account | null;
  }
>;

function makeSceneAccount(): SceneAccounts[AccountSwitcherScene] {
  return {
    currentAccount: null,
  };
}
export const sceneAccountsAtom = atomByMMKV<SceneAccounts>('@SceneAccounts', {
  Send: makeSceneAccount(),
  Swap: makeSceneAccount(),
  Bridge: makeSceneAccount(),
});

export function useSceneAccounts(
  forScene: AccountSwitcherScene,
  options?: {
    disableAutoFetch?: boolean;
  },
) {
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });

  const [sceneAccounts, setSceneAccounts] = useAtom(sceneAccountsAtom);

  const { disableAutoFetch } = options || {};
  useEffect(() => {
    if (!disableAutoFetch) {
      fetchAccounts();
    }
  }, [disableAutoFetch, fetchAccounts]);

  const setSceneCurrentAccount = useCallback(
    (account: Account | null) => {
      setSceneAccounts(prev => ({
        ...prev,
        [forScene]: {
          ...prev[forScene],
          currentAccount: account,
        },
      }));
    },
    [forScene, setSceneAccounts],
  );

  const computed = useMemo(() => {
    const sceneAccount = sceneAccounts[forScene];

    let sceneCurrentAccount: Account | null = accounts[0] || null;
    let sceneCurrentAccountIndex = -1;
    const restSortedAccountsList: Account[] = [];

    accounts.forEach((account, idx) => {
      if (account.address === sceneAccount.currentAccount?.address) {
        sceneCurrentAccount = account;
        sceneCurrentAccountIndex = idx;
      }
    });

    if (sceneCurrentAccountIndex === -1) sceneCurrentAccountIndex = 0;

    if (sceneCurrentAccountIndex > -1) {
      restSortedAccountsList.push(
        ...accounts.slice(0, sceneCurrentAccountIndex),
      );
      restSortedAccountsList.push(
        ...accounts.slice(sceneCurrentAccountIndex + 1),
      );
    }

    return {
      sceneCurrentAccount,
      restSortedAccountsList,
    };
  }, [accounts, sceneAccounts, forScene]);

  return {
    ...computed,
    setSceneCurrentAccount,
  };
}
