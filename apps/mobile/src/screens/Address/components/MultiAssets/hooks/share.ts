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
  return isFocused;
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
  disableToken,
  disableDefi,
  disableNFT,
}: {
  isFocused: boolean;
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
    const cacheTop10AssetsId = setTimeout(() => {
      if (!isFocused) {
        return;
      }
      if (initRef.current) {
        return;
      }
      initRef.current = true;
      checkIsExpireAndUpdate(false, {
        disableToken,
        disableDefi,
        disableNFT,
        realTimeAddresses: top10Addresses,
        ignoreLoading: !top10Balance,
      });
    }, 50);
    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, !top10Balance, top10Addresses.length]);

  useEffect(() => {
    if (triggerRefresh && isFocused) {
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
    isFocused,
    setTriggerRefresh,
    triggerRefresh,
  ]);

  return {
    triggerUpdate,
  };
};
