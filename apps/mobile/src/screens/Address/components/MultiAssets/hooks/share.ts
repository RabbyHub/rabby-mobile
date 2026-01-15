import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusedTab } from 'react-native-collapsible-tab-view';

import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { useLoadAssets } from '@/screens/Search/useAssets';
import { useAccountInfo } from '../hooks';
import { useBalanceAccounts } from '@/hooks/useAccountsBalance';
import { TabName } from '../TabsMultiAssets';
import { useMyAccounts } from '@/hooks/account';
import balanceStore from '@/store/balance';

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
  const { balanceAccounts } = useBalanceAccounts();
  const batchGetTotalBalance = balanceStore(s => s.batchGetTotalBalance);
  const { checkIsExpireAndUpdate } = useLoadAssets();
  const triggerUpdate = useCallback(
    (force?: boolean) => batchGetTotalBalance(myTop10Addresses, force),
    [batchGetTotalBalance, myTop10Addresses],
  );

  useEffect(() => {
    initRef.current = false;
  }, [myTop10Addresses.length]);

  const hasBalanceAccounts = useMemo(() => {
    if (!myTop10Addresses.length) {
      return false;
    }
    return myTop10Addresses.some(
      address => !!balanceAccounts[address.toLowerCase()],
    );
  }, [balanceAccounts, myTop10Addresses]);

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
        ignoreLoading: !hasBalanceAccounts,
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
    hasBalanceAccounts,
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
