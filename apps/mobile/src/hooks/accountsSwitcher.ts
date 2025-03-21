import { atomByMMKV } from '@/core/storage/mmkv';

import type { Account, IPinAddress } from '@/core/services/preference';
import { useAccounts, useCurrentAccount, usePinAddresses } from './account';
import React, { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import {
  sortAccountList,
  useSortAddressList,
} from '@/screens/Address/useSortAddressList';
import { KEYRING_CLASS, KeyringAccount } from '@rabby-wallet/keyring-utils';
import { apisAccountSwitch } from '@/core/apis';
import cloneDeep from 'lodash/cloneDeep';
import { RootNames } from '@/constant/layout';

type SceneAccountInfo = {
  currentAccount: KeyringAccount | null;
  /**
   * @description account used to sign for current scene
   */
  signingAccount: KeyringAccount | null;
  /**
   * @description use all accounts in this scene, not only one "current" account
   *
   * in some scenes it means fetch all data from all accounts, such as transaction history
   */
  useAllAccounts?: boolean;
};

function makeSceneAccount(): SceneAccountInfo {
  return {
    currentAccount: null,
    signingAccount: null,
    useAllAccounts: false,
  };
}
const AccountSwitcherInfos = {
  MakeTransactionAbout: makeSceneAccount(),
  // Send: makeSceneAccount(),
  SendNFT: makeSceneAccount(),
  // Swap: makeSceneAccount(),
  // Bridge: makeSceneAccount(),

  History: makeSceneAccount(),
  MultiHistory: makeSceneAccount(),
  // HistoryFilterScam: makeSceneAccount(), // treat HistoryFilterScam screen as History screen

  Receive: makeSceneAccount(),
  GasAccount: makeSceneAccount(),

  Approvals: makeSceneAccount(),

  '@ActiveDappWebViewModal': makeSceneAccount(),
};

export type PropsForAccountSwitchScreen<T extends void | object = void> = {
  isForMultipleAdderss?: boolean;
} & (T extends void ? {} : T);

export type AccountSwitcherScene = keyof typeof AccountSwitcherInfos;

type SceneAccounts = {
  [K in AccountSwitcherScene]?: SceneAccountInfo;
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

export const AccountSwitcherContext = React.createContext<SceneAccountInfo>(
  makeSceneAccount(),
);

// TODO: maybe we should trim all siginingAccount on bootstrap?
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

export function usePreFetchBeforeEnterScene() {
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { fetchCurrentAccountAsync } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const { getPinAddressesAsync } = usePinAddresses({
    disableAutoFetch: true,
  });

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
    preFetchData,
  };
}

export function useSwitchSceneCurrentAccount() {
  const [sceneAccountInfo, setSceneAccountInfo] = useAtom(sceneAccountInfoAtom);

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
      const prev = sceneAccountInfo;
      const { maybeReEntrant } = options || {};

      const needSyncToSession = scene === '@ActiveDappWebViewModal';

      try {
        const patches: Partial<(typeof prev)[AccountSwitcherScene]> = {};
        const finalResult = {
          nextEnableAccount: undefined as null | Account | undefined,
          result: prev,
        };

        const doReturn = async <T extends typeof prev>(val: T) => {
          setSceneAccountInfo(val);

          try {
            if (finalResult.nextEnableAccount) {
              await apisAccountSwitch.enableSceneAccount(
                finalResult.nextEnableAccount,
                { activeLastUsedAccountOptions: { needSyncToSession } },
              );
            } else if (finalResult.nextEnableAccount === null) {
              await apisAccountSwitch.inactivateSceneAccount();
            }
          } catch (error) {
            if (__DEV__) {
              console.error('switchSceneCurrentAccount doReturn error', error);
            }
          } finally {
            return val;
          }
        };

        if (!maybeReEntrant && prev[scene]?.useAllAccounts) {
          patches.useAllAccounts = false;
        }

        if (account) {
          finalResult.nextEnableAccount = account;
          // await apisAccountSwitch.enableSceneAccount(account);

          // avoid duplicate set same account
          if (isSameAccount(account, prev[scene]?.currentAccount)) {
            delete patches.currentAccount;
          } else {
            patches.currentAccount = normalizeSceneKeyringAccount(account);
          }
        } else {
          patches.currentAccount = null;
          finalResult.nextEnableAccount = null;
          // await apisAccountSwitch.inactivateSceneAccount();
          if (!prev[scene]?.currentAccount) {
            return doReturn(prev);
          }
        }

        if (Object.keys(patches).length === 0) {
          return doReturn(prev);
        }

        return doReturn({
          ...prev,
          [scene]: {
            ...prev[scene],
            ...patches,
          },
        });
      } catch (error) {
        if (__DEV__) {
          console.error('switchSceneSigningAccount error', error);
        }
        return prev;
      }
    },
    [sceneAccountInfo, setSceneAccountInfo],
  );

  /**
   * @description
   * @warn you must wait this function end, then the `currentAccount` will be updated really
   */
  const switchSceneSigningAccount = useCallback(
    async (scene: AccountSwitcherScene, account: Account | null) => {
      const prev = sceneAccountInfo;

      try {
        const patches: Partial<(typeof prev)[AccountSwitcherScene]> = {};

        const doReturn = <T extends typeof prev>(val: T) => {
          setSceneAccountInfo(val);
          return val;
        };

        if (account) {
          const result = await apisAccountSwitch.enableSceneAccount(account);
          // // leave here for debug
          // if (__DEV__) console.warn('result', result);

          // avoid duplicate set same account
          if (isSameAccount(account, prev[scene]?.signingAccount)) {
            delete patches.signingAccount;
          } else {
            patches.signingAccount = normalizeSceneKeyringAccount(account);
          }
        } else {
          patches.signingAccount = null;
          await apisAccountSwitch.inactivateSceneAccount();
          if (!prev[scene]?.signingAccount) {
            return doReturn(prev);
          }
        }

        if (Object.keys(patches).length === 0) {
          return doReturn(prev);
        }

        return doReturn({
          ...prev,
          [scene]: { ...prev[scene], ...patches },
        });
      } catch (error) {
        if (__DEV__) {
          console.error('switchSceneSigningAccount error', error);
        }
        return prev;
      }
    },
    [sceneAccountInfo, setSceneAccountInfo],
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
    switchSceneSigningAccount,
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

function computeSceneAccountInfo({
  forScene,
  accounts = [],
  pinAddresses,

  sceneCurrentAccount,
  isSceneUsingAllAccounts = false,
}: {
  forScene: AccountSwitcherScene;
  accounts: Account[];
  /** @description empty means not sort based on it */
  pinAddresses?: IPinAddress[];

  sceneCurrentAccount?: SceneAccountInfo['currentAccount'];
  isSceneUsingAllAccounts?: SceneAccountInfo['useAllAccounts'];
}) {
  const isSceneSupportAllAccounts = ScenesSupportAllAccounts.includes(forScene);

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
    highlightedAddresses: pinAddresses || [],
  });
  if (
    !result.isSceneUsingAllAccounts &&
    !result.finalSceneCurrentAccount &&
    accounts.length
  ) {
    result.finalSceneCurrentAccount = result.myAddresses[0] || accounts[0];
  }

  if (!result.isSceneUsingAllAccounts && result.finalSceneCurrentAccount) {
    result.shouldSafeAddressesExpanded = !!result.safeAddresses.find(account =>
      isSameAccount(account, result.finalSceneCurrentAccount),
    );
    if (!result.shouldSafeAddressesExpanded) {
      result.shouldWatchAddressesExpanded = !!result.watchAddresses.find(
        account => isSameAccount(account, result.finalSceneCurrentAccount),
      );
    }
  }

  return result;
}

type SceneAccount = Account & {
  isPinned?: boolean;
};
export function useSceneAccountInfo(options: {
  forScene: AccountSwitcherScene;
}) {
  const { accounts } = useAccounts({ disableAutoFetch: true });

  const { forScene } = options || {};
  const [sceneAccounts] = useAtom(sceneAccountInfoAtom);

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

  const isHideToken = useMemo(() => {
    return ['History', 'MultiHistory', '@ActiveDappWebViewModal'].includes(
      forScene,
    );
  }, [forScene]);

  const sceneAccountInfo = sceneAccounts[forScene];
  const computeFinalSceneAccount = useCallback(
    (account?: Account | null) => {
      const result = computeSceneAccountInfo({
        forScene,
        sceneCurrentAccount:
          (account || sceneAccountInfo?.currentAccount) ?? null,
        isSceneUsingAllAccounts: !!sceneAccountInfo?.useAllAccounts,
        accounts,
        pinAddresses,
      });

      return result.finalSceneCurrentAccount;
    },
    [
      forScene,
      accounts,
      sceneAccountInfo?.currentAccount,
      sceneAccountInfo?.useAllAccounts,
      pinAddresses,
    ],
  );
  const computed = useMemo(() => {
    return computeSceneAccountInfo({
      forScene,

      sceneCurrentAccount: sceneAccountInfo?.currentAccount ?? null,
      isSceneUsingAllAccounts: !!sceneAccountInfo?.useAllAccounts,
      accounts,
      pinAddresses,
    });
  }, [
    forScene,
    accounts,
    sceneAccountInfo?.currentAccount,
    sceneAccountInfo?.useAllAccounts,
    pinAddresses,
  ]);

  return {
    ...computed,
    sceneCurrentAccount: sceneAccountInfo?.currentAccount,
    sceneSigingAccount: sceneAccountInfo?.signingAccount,
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
    computeFinalSceneAccount,
    isHideToken,
  };
}

function getDefaultSceneAccountInfo() {
  return {
    forScene: null,
    ofScreen: '',
    sceneScreenRenderId: '' as const,
  };
}
type OfSceneScreen =
  | typeof RootNames.MultiSwap
  | typeof RootNames.MultiBridge
  | typeof RootNames.MultiSend;
const ScreenSceneAccountContext = React.createContext<
  | {
      forScene: null;
      ofScreen: string;
      sceneScreenRenderId: '' | `${string}-${OfSceneScreen}`;
    }
  | {
      forScene: AccountSwitcherScene & 'MakeTransactionAbout';
      ofScreen: OfSceneScreen;
      sceneScreenRenderId: '' | `${string}-${OfSceneScreen}`;
    }
>(getDefaultSceneAccountInfo());

type ProviderProps = React.ComponentProps<
  typeof ScreenSceneAccountContext.Provider
>;
export const ScreenSceneAccountProvider: React.FC<
  Omit<ProviderProps, 'value'> & Partial<Pick<ProviderProps, 'value'>>
> = props => {
  const { children, value } = props;
  return React.createElement(ScreenSceneAccountContext.Provider, {
    value: value || getDefaultSceneAccountInfo(),
    children,
  });
};
export function useScreenSceneAccountContext() {
  try {
    return React.useContext(ScreenSceneAccountContext);
  } catch (error) {
    if (__DEV__) {
      console.error('useScreenSceneAccountContext error', error);
    }
    return getDefaultSceneAccountInfo();
  }
}
