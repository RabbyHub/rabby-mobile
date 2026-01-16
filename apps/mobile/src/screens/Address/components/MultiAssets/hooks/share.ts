import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusedTab } from 'react-native-collapsible-tab-view';

import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { useLoadAssets } from '@/screens/Search/useAssets';
import { useAccountInfo } from '../hooks';
import {
  apisAccountsBalance,
  useAccountsBalanceTrigger,
} from '@/hooks/useAccountsBalance';
import { TabName } from '../TabsMultiAssets';
import { useMyAccounts } from '@/hooks/account';

export const useIsFocusedCurrentTab = (tabName: TabName) => {
  const hasBeenFocusedRef = useRef(false);
  const focusedTab = useFocusedTab();

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === tabName;
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab, tabName]);

  const isFocusing = useMemo(() => {
    return focusedTab === tabName;
  }, [focusedTab, tabName]);

  return { isFocused, isFocusing };
};

export const useFindAccountByAddress = () => {
  const { accounts } = useMyAccounts();

  const getAccountByAddress = useCallback(
    (address: string) => {
      return accounts.find(account => isSameAddress(account?.address, address));
    },
    [accounts],
  );
  return getAccountByAddress;
};

export const useCheckIsExpireAndUpdate = ({
  isFocused,
  isFocusing,
  disableNFT,
}: {
  isFocused: boolean;
  isFocusing: boolean;
  disableNFT?: boolean;
}) => {
  const initRef = useRef(false);
  const { myTop10Addresses } = useAccountInfo();
  const { triggerUpdate } = useAccountsBalanceTrigger();
  const { checkIsExpireAndUpdate } = useLoadAssets();

  useEffect(() => {
    initRef.current = false;
  }, [myTop10Addresses.length]);

  useEffect(() => {
    if (!isFocused) return;

    const cacheTop10AssetsId = setTimeout(() => {
      if (initRef.current) {
        return;
      }
      initRef.current = true;
      checkIsExpireAndUpdate(false, {
        disableNFT,
        updateReturn: true,
        realTimeAddresses: myTop10Addresses,
        ignoreLoading:
          !apisAccountsBalance.getLatestTotalBalance(myTop10Addresses),
      });
    }, 50);

    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
  }, [isFocused, disableNFT, checkIsExpireAndUpdate, myTop10Addresses]);

  useEffect(() => {
    if (isFocusing) {
      checkIsExpireAndUpdate(false, {
        disableNFT,
      });
    }
  }, [checkIsExpireAndUpdate, disableNFT, isFocusing]);

  return {
    triggerUpdate,
  };
};
