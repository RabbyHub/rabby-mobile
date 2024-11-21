import { atomByMMKV } from '@/core/storage/mmkv';

import type { Account, IPinAddress } from '@/core/services/preference';
import { useAccounts, useCurrentAccount, usePinAddresses } from './account';
import { useCallback, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

const AccountSwitcherInfos = {
  Send: makeSceneAccount(),
  Swap: makeSceneAccount(),
  Bridge: makeSceneAccount(),
};

export type AccountSwitcherScene = keyof typeof AccountSwitcherInfos;

type SceneAccounts = Record<
  AccountSwitcherScene,
  {
    currentAccount: Account | null;
  }
>;

function makeSceneAccount() {
  return {
    currentAccount: null,
  };
}
export const sceneAccountInfoAtom = atomByMMKV<SceneAccounts>(
  '@SceneAccounts',
  AccountSwitcherInfos,
);

export function useSwitchAccountBeforeEnterScene() {
  const [sceneAccountInfo, setSceneAccountInfo] = useAtom(sceneAccountInfoAtom);

  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { fetchCurrentAccountAsync } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const { pinAddresses, getPinAddressesAsync } = usePinAddresses({
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

export function useSceneCurrentAccount(forScene: AccountSwitcherScene) {
  const [sceneAccountInfo, setSceneAccountInfo] = useAtom(sceneAccountInfoAtom);

  // const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { currentAccount, fetchCurrentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const setSceneCurrentAccount = useCallback(
    (scene: AccountSwitcherScene, account: Account | null) => {
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

  const fetchSceneCurrentAccount = useCallback(async () => {
    await Promise.allSettled([fetchCurrentAccount()]);
  }, [fetchCurrentAccount]);

  return {
    // sceneCurrentAccount: sceneAccountInfo[forScene]?.currentAccount,
    sceneCurrentAccount: currentAccount,
    setSceneCurrentAccount,
    fetchSceneCurrentAccount,
  };
}

type SceneAccount = Account & {
  isPinned?: boolean;
};
export function useSceneAccountInfo(options: {
  forScene: AccountSwitcherScene;
  disableAutoFetch?: boolean;
}) {
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });

  // const { fetchCurrentAccount } = useCurrentAccount({ disableAutoFetch: true });

  const { forScene, disableAutoFetch } = options || {};
  const { sceneCurrentAccount } = useSceneCurrentAccount(forScene);

  const { pinAddresses, getPinAddressesAsync } = usePinAddresses({
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

  const computed = useMemo(() => {
    const result = {
      sceneCurrentAccountIndexInMyAddresses: -1,
      sceneCurrentAccount: null as null | SceneAccount,
      myAddresses: [] as SceneAccount[],
      myRestAddresses: [] as SceneAccount[],
      watchAddresses: [] as SceneAccount[],
      safeAddresses: [] as SceneAccount[],
    };

    for (const [idx, origAccount] of accounts.entries()) {
      const account: SceneAccount = { ...origAccount };

      // const mapKey = account.brandName + '-' + account.address;
      // if (pinAddressesDict[mapKey]) {
      //   account.isPinned = true;
      // }

      if (account.type === KEYRING_CLASS.WATCH) {
        result.watchAddresses.push(account);
      } else if (account.type === KEYRING_CLASS.GNOSIS) {
        result.safeAddresses.push(account);
      } else {
        result.myAddresses.push(account);

        if (
          sceneCurrentAccount &&
          account.address === sceneCurrentAccount?.address
        ) {
          result.sceneCurrentAccountIndexInMyAddresses = idx;
          result.sceneCurrentAccount = account;
        } else {
          result.myRestAddresses.push(account);
        }
      }
    }

    return result;
  }, [accounts, sceneCurrentAccount]);

  computed.myAddresses = useSortAddressList(computed.myAddresses);

  return {
    ...computed,
    isPinnedAccount,
  };
}
