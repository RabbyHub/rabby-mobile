import { atomByMMKV } from '@/core/storage/mmkv';

import type { Account, IPinAddress } from '@/core/services/preference';
import { useAccounts, useCurrentAccount, usePinAddresses } from './account';
import { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import {
  sortAccountList,
  useSortAddressList,
} from '@/screens/Address/useSortAddressList';
import { KEYRING_CLASS, KeyringAccount } from '@rabby-wallet/keyring-utils';
import { apisAccountSwitch } from '@/core/apis';
import cloneDeep from 'lodash/cloneDeep';

const AccountSwitcherInfos = {
  MakeTransactionAbout: makeSceneAccount(),
  // Send: makeSceneAccount(),
  SendNFT: makeSceneAccount(),
  // Swap: makeSceneAccount(),
  // Bridge: makeSceneAccount(),

  History: makeSceneAccount(),
  MultiHistory: makeSceneAccount(),
  Receive: makeSceneAccount(),
  // HistoryFilterScam: makeSceneAccount(), // treat HistoryFilterScam screen as History screen

  GasAccount: makeSceneAccount(),

  '@ActiveDappWebViewModal': makeSceneAccount(),
};

export type PropsForAccountSwitchScreen<T extends void | object = void> = {
  isForMultipleAdderss?: boolean;
} & (T extends void ? {} : T);

export type AccountSwitcherScene = keyof typeof AccountSwitcherInfos;

type SceneAccounts = {
  [K in AccountSwitcherScene]?: {
    currentAccount: KeyringAccount | null;
    /**
     * @description use all accounts in this scene, not only one "current" account
     *
     * in some scenes it means fetch all data from all accounts, such as transaction history
     */
    useAllAccounts?: boolean;
  };
};

export function normalizeSceneKeyringAccount(
  input: Account | KeyringAccount,
): KeyringAccount {
  return {
    address: input.address,
    brandName: input.brandName,
    type: input.type,
  };
}

export function sceneKeyringAccountToAccount(
  input: KeyringAccount,
  partials: {
    aliasName?: string;
    balance?: number;
  },
): Account {
  return {
    ...input,
    aliasName: partials.aliasName,
    balance: partials.balance,
  };
}

function makeSceneAccount() {
  return {
    currentAccount: null,
    useAllAccounts: false,
  };
}
export const sceneAccountInfoAtom = atomByMMKV<SceneAccounts>(
  '@SceneAccounts',
  AccountSwitcherInfos,
);

export function useResetSceneAccountInfo() {
  const [, setSceneAccountInfo] = useAtom(sceneAccountInfoAtom);

  const resetSceneAccountInfo = useCallback(() => {
    setSceneAccountInfo(cloneDeep(AccountSwitcherInfos));
  }, [setSceneAccountInfo]);

  return {
    resetSceneAccountInfo,
  };
}

export function useSwitchAccountBeforeEnterScene() {
  const [, setSceneAccountInfo] = useAtom(sceneAccountInfoAtom);

  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { fetchCurrentAccountAsync } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const { getPinAddressesAsync } = usePinAddresses({
    disableAutoFetch: true,
  });

  const switchAccountBeforeEnterScene = useCallback(
    (scene: AccountSwitcherScene, account: Account) => {
      setSceneAccountInfo(prev => ({
        ...prev,
        [scene]: {
          ...prev[scene],
          currentAccount: account,
        },
      }));
    },
    [setSceneAccountInfo],
  );

  const preFetchData = useCallback(async () => {
    setTimeout(() => {
      Promise.allSettled([
        fetchAccounts(),
        fetchCurrentAccountAsync(),
        getPinAddressesAsync(),
      ]);
    }, 50);
  }, [fetchAccounts, fetchCurrentAccountAsync, getPinAddressesAsync]);

  return {
    switchAccountBeforeEnterScene,
    preFetchData,
  };
}

const lastUsedAccountAtom = atom<Account | null>(null);
export function useLastUsedAccount(options?: { disableAutoFetch?: boolean }) {
  const [lastUsedAccount, setLastUsedAccount] = useAtom(lastUsedAccountAtom);

  const { disableAutoFetch } = options || {};

  const fetchLastUsedAccount = useCallback(async () => {
    const lastUsedAccount = await apisAccountSwitch.getLastUsedAccount();
    setLastUsedAccount(lastUsedAccount);
  }, [setLastUsedAccount]);

  useEffect(() => {
    if (!disableAutoFetch) {
      fetchLastUsedAccount();
    }
  }, [disableAutoFetch, fetchLastUsedAccount]);

  return {
    lastUsedAccount,
    fetchLastUsedAccount,
  };
}

export function useSwitchSceneCurrentAccount() {
  const [, setSceneAccountInfo] = useAtom(sceneAccountInfoAtom);

  /**
   * @description switch current account in scene, enable it if account is not null, or
   * inactivate it if account is null
   *
   * this function is re-entrant, it will not set same account again
   */
  const switchSceneCurrentAccount = useCallback(
    async (
      scene: AccountSwitcherScene,
      account: Account | null,
      options?: { maybeReEntrant?: boolean },
    ) => {
      const { maybeReEntrant } = options || {};
      setSceneAccountInfo(prev => {
        const patches: Partial<(typeof prev)[AccountSwitcherScene]> = {};

        if (!maybeReEntrant && prev[scene]?.useAllAccounts) {
          patches.useAllAccounts = false;
        }

        if (account) {
          apisAccountSwitch.enableSceneAccount(account);

          // avoid duplicate set same account
          if (isSameAccount(account, prev[scene]?.currentAccount)) {
            delete patches.currentAccount;
          } else {
            patches.currentAccount = normalizeSceneKeyringAccount(account);
          }
        } else {
          apisAccountSwitch.inactivateSceneAccount();
          if (!prev[scene]?.currentAccount) {
            return prev;
          }
        }

        if (Object.keys(patches).length === 0) {
          return prev;
        }

        return {
          ...prev,
          [scene]: {
            ...prev[scene],
            ...patches,
          },
        };
      });
    },
    [setSceneAccountInfo],
  );

  const toggleUseAllAccountsOnScene = useCallback(
    (scene: AccountSwitcherScene, useAll: boolean) => {
      setSceneAccountInfo(prev => {
        const nextVal = ScenesSupportAllAccounts.includes(scene)
          ? useAll
          : false;

        return {
          ...prev,
          [scene]: {
            ...prev[scene],
            useAllAccounts: nextVal,
          },
        };
      });
    },
    [setSceneAccountInfo],
  );

  return {
    switchSceneCurrentAccount,
    toggleUseAllAccountsOnScene,
  };
}

export function isSameAccount(
  account: Account,
  saccount?: SceneAccount | null,
) {
  if (!saccount) return false;

  return (
    saccount?.address === account.address &&
    saccount?.brandName === account.brandName &&
    saccount?.type === account.type
  );
}

const ScenesSupportAllAccounts: AccountSwitcherScene[] = [
  // 'Swap',
  'MultiHistory',
];

type SceneAccount = Account & {
  isPinned?: boolean;
};
export function useSceneAccountInfo(options: {
  forScene: AccountSwitcherScene;
}) {
  const { accounts } = useAccounts({ disableAutoFetch: true });

  const { forScene } = options || {};
  const [sceneAccountInfo] = useAtom(sceneAccountInfoAtom);

  const sceneCurrentAccount = sceneAccountInfo[forScene]?.currentAccount;
  const isSceneUsingAllAccounts = !!sceneAccountInfo[forScene]?.useAllAccounts;

  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const pinAddressesDict = useMemo(() => {
    type MapKey = `${IPinAddress['brandName']}-${IPinAddress['address']}}`;
    return pinAddresses.reduce((acc, pinAddress) => {
      acc[pinAddress.brandName + '-' + pinAddress.address] = true;
      return acc;
    }, {} as Record<MapKey, boolean>);
  }, [pinAddresses]);

  const isPinnedAccount = useCallback(
    (account: Account) => {
      return !!pinAddressesDict[account.brandName + '-' + account.address];
    },
    [pinAddressesDict],
  );

  const isSceneSupportAllAccounts = ScenesSupportAllAccounts.includes(forScene);

  const computed = useMemo(() => {
    const result = {
      isSceneSupportAllAccounts,
      isSceneUsingAllAccounts:
        isSceneSupportAllAccounts && isSceneUsingAllAccounts,
      totalCountOfAccount: accounts.length,
      // sceneCurrentAccountIndexInMyAddresses: -1,
      finalSceneCurrentAccount: null as null | SceneAccount,
      myAddresses: [] as SceneAccount[],
      watchAddresses: [] as SceneAccount[],
      shouldWatchAddressesExpanded: false,
      safeAddresses: [] as SceneAccount[],
      shouldSafeAddressesExpanded: false,
    };

    for (const origAccount of accounts.values()) {
      const account: SceneAccount = { ...origAccount };

      if (account.type === KEYRING_CLASS.WATCH) {
        result.watchAddresses.push(account);
      } else if (account.type === KEYRING_CLASS.GNOSIS) {
        result.safeAddresses.push(account);
      } else {
        result.myAddresses.push(account);
      }

      if (isSameAccount(account, sceneCurrentAccount)) {
        result.finalSceneCurrentAccount = sceneKeyringAccountToAccount(
          sceneCurrentAccount!,
          account,
        );
      }
    }

    result.myAddresses = sortAccountList(result.myAddresses, {
      highlightedAddresses: pinAddresses,
    });
    if (
      !result.isSceneUsingAllAccounts &&
      !result.finalSceneCurrentAccount &&
      accounts.length
    ) {
      result.finalSceneCurrentAccount = result.myAddresses[0] || accounts[0];
    }
    if (result.finalSceneCurrentAccount) {
      result.shouldSafeAddressesExpanded = !!result.safeAddresses.find(
        account => isSameAccount(account, result.finalSceneCurrentAccount),
      );
      if (!result.shouldSafeAddressesExpanded) {
        result.shouldWatchAddressesExpanded = !!result.watchAddresses.find(
          account => isSameAccount(account, result.finalSceneCurrentAccount),
        );
      }
    }

    return result;
  }, [
    accounts,
    pinAddresses,
    isSceneSupportAllAccounts,
    isSceneUsingAllAccounts,
    sceneCurrentAccount,
  ]);

  return {
    ...computed,
    sceneCurrentAccountDepKey: computed.isSceneUsingAllAccounts
      ? 'all'
      : [
          computed.finalSceneCurrentAccount?.address,
          computed.finalSceneCurrentAccount?.brandName,
          computed.finalSceneCurrentAccount?.type,
        ]
          .filter(Boolean)
          .join('-'),
    isPinnedAccount,
  };
}
