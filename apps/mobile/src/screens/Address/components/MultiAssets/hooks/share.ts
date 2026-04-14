import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusedTab } from 'react-native-collapsible-tab-view';

import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { useLoadAssets } from '@/screens/Search/useAssets';
import { useAccountInfo } from '../hooks';
import { useBalanceAccounts } from '@/store/balance';
import { TabName } from '../TabsMultiAssets';
import { useMyAccounts } from '@/hooks/account';
import addressBalanceStore from '@/store/balance';
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
}: {
  isFocused: boolean;
  isFocusing: boolean;
}) => {
  const initRef = useRef(false);
  const { myTop10Addresses } = useAccountInfo();
  const { balanceAccounts } = useBalanceAccounts();
  const { checkIsExpireAndUpdate } = useLoadAssets();
  const triggerUpdate = useCallback(
    (force?: boolean) =>
      addressBalanceStore.batchGetTotalBalance(myTop10Addresses, force, {
        scene: 'AddressMultiAssets',
        requester: 'useCheckIsExpireAndUpdate',
        endpoint: 'openapi.getTotalBalanceV2',
      }),
    [myTop10Addresses],
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
        updateReturn: true,
        realTimeAddresses: myTop10Addresses,
        ignoreLoading: !hasBalanceAccounts,
      });
    }, 50);

    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
  }, [isFocused, checkIsExpireAndUpdate, myTop10Addresses, hasBalanceAccounts]);

  useEffect(() => {
    if (isFocusing) {
      checkIsExpireAndUpdate(false, {});
    }
  }, [checkIsExpireAndUpdate, isFocusing]);

  return {
    triggerUpdate,
  };
};
