import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFocusedTab } from 'react-native-collapsible-tab-view';

import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { useAssets } from '@/screens/Search/useAssets';
import { useAccountInfo } from '../hooks';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { TabName } from '../TabsMultiAssets';
import { useMyAccounts } from '@/hooks/account';
import { useTriggerUpdate } from './triggerUpdate';

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
  const { top10Addresses } = useAccountInfo();
  const { getTotalBalance, triggerUpdate } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });
  const { triggerUpdate: triggerRefresh, setTriggerUpdate: setTriggerRefresh } =
    useTriggerUpdate();
  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const { checkIsExpireAndUpdate } = useAssets({ hideCombined: true });

  useEffect(() => {
    initRef.current = false;
  }, [top10Addresses.length]);

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
        realTimeAddresses: top10Addresses,
        ignoreLoading: !top10Balance,
      });
    }, 50);

    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
  }, [
    isFocused,
    top10Balance,
    disableToken,
    disableDefi,
    disableNFT,
    checkIsExpireAndUpdate,
    top10Addresses,
  ]);

  useEffect(() => {
    if (triggerRefresh && isFocusing) {
      checkIsExpireAndUpdate(true, {
        disableToken,
        disableDefi,
        disableNFT,
      });
      setTriggerRefresh(false);
    }
  }, [
    checkIsExpireAndUpdate,
    disableDefi,
    disableNFT,
    disableToken,
    isFocusing,
    setTriggerRefresh,
    triggerRefresh,
  ]);

  return {
    triggerUpdate,
  };
};
