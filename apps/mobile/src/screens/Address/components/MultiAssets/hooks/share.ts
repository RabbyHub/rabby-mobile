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
import { findAccountByPriority } from '@/utils/account';

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
      const _accounts = accounts.filter(account =>
        isSameAddress(account?.address, address),
      );
      return findAccountByPriority(_accounts);
    },
    [accounts],
  );
  return getAccountByAddress;
};

export const useCheckIsExpireAndUpdate = ({
  isFocused,
  isFocusing,
  disableToken,
  disableDefi,
  disableNFT,
}: {
  isFocused: boolean;
  isFocusing: boolean;
  disableToken?: boolean;
  disableDefi?: boolean;
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
        disableToken,
        disableDefi,
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
  }, [
    isFocused,
    disableToken,
    disableDefi,
    disableNFT,
    checkIsExpireAndUpdate,
    myTop10Addresses,
  ]);

  useEffect(() => {
    if (isFocusing) {
      checkIsExpireAndUpdate(false, {
        disableToken,
        disableDefi,
        disableNFT,
      });
    }
  }, [
    checkIsExpireAndUpdate,
    disableDefi,
    disableNFT,
    disableToken,
    isFocusing,
  ]);

  return {
    triggerUpdate,
  };
};
