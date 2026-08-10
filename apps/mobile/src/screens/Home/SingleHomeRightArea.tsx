/* eslint-disable react-native/no-inline-styles */
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import type { AbstractPortfolioToken } from './types';
import { useTranslation } from 'react-i18next';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import { useSingleHomeAccount, apisSingleHome } from './hooks/singleHome';
import RcIconSettingCC from '@/assets2024/icons/common/IconSetting.svg';
import { naviPush } from '@/utils/navigation';
import { HeaderRightHistoryButton } from './components/HeaderRightHistoryButton';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

interface HeaderRightHistoryProps {
  isInTokenDetail?: boolean;
  isMultiAddress?: boolean;
  tokenItem?: AbstractPortfolioToken;
}

const refreshHistoryIdState = zCreate<{ refreshId: number }>(() => ({
  refreshId: 0,
}));

export function setRefreshHistoryId(valOrFunc: UpdaterOrPartials<number>) {
  refreshHistoryIdState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.refreshId, valOrFunc, {
      strict: true,
    });
    return { refreshId: newVal };
  });
}

export function useRefreshHistoryId() {
  return {
    refreshHistoryId: useActivityStore(
      refreshHistoryIdState,
      state => state.refreshId,
      Object.is,
      { storeLabel: 'single-address-history-refresh' },
    ),
    setRefreshHistoryId,
  };
}

export const HeaderRightHistory: React.FC<HeaderRightHistoryProps> = ({
  isInTokenDetail,
  isMultiAddress,
  tokenItem,
}) => {
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const timeRef = useRef<null | ReturnType<typeof setInterval>>(null);
  const { navigation } = useSafeSetNavigationOptions();
  const [historyCount, setHistoryCount] = useState<{
    success: number;
    fail: number;
  }>();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const { currentAccount } = useSingleHomeAccount();

  const fetchHistory = useCallback(async () => {
    if (!currentAccount) {
      return;
    }

    const address = currentAccount.address;
    const [failCount, successCount] = await Promise.all([
      transactionHistoryServiceApi.getFailedCount(address),
      transactionHistoryServiceApi.getSucceedCount(address),
    ]);
    setHistoryCount({
      success: successCount,
      fail: failCount,
    });

    if (tokenItem) {
      // single token no pending tx
      return;
    }

    const { pendingsLength } =
      await transactionHistoryServiceApi.getPendingsAddresses([address]);
    setPendingTxCount(pendingsLength);
    timeRef.current && clearInterval(timeRef.current);
    timeRef.current = pendingsLength
      ? setInterval(() => {
          void fetchHistory().catch(console.error);
        }, 5000)
      : null;
  }, [currentAccount, tokenItem]);

  const refreshId = useActivityStore(
    refreshHistoryIdState,
    state => state.refreshId,
    Object.is,
    { storeLabel: 'single-address-history-refresh' },
  );
  useEffect(() => {
    if (refreshId > 0) {
      void fetchHistory().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshId]);

  useFocusEffect(
    useCallback(() => {
      void fetchHistory().catch(console.error);
      return () => {
        if (timeRef.current) {
          clearInterval(timeRef.current);
          timeRef.current = null;
        }
      };
    }, [fetchHistory]),
  );

  const openHistory = useCallback(async () => {
    apisSingleHome.setFoldChart(true);
    currentAccount &&
      (await switchSceneCurrentAccount('History', currentAccount));
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: isMultiAddress
          ? RootNames.MultiAddressHistory
          : RootNames.History,
        params: {
          isInTokenDetail,
          tokenItem,
          isMultiAddress,
          currentAddress: currentAccount?.address.toLowerCase(),
        },
      }),
    );
  }, [
    switchSceneCurrentAccount,
    currentAccount,
    navigation,
    isMultiAddress,
    isInTokenDetail,
    tokenItem,
  ]);

  return (
    <HeaderRightHistoryButton
      pendingTxCount={pendingTxCount}
      historyCount={historyCount}
      onPress={openHistory}
    />
  );
};

export const SingleHomeRightArea = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const { colors2024 } = useTheme2024();
  const { t } = useTranslation();

  const { currentAccount } = useSingleHomeAccount();

  const onPress = () => {
    if (currentAccount) {
      apisSingleHome.setFoldChart(true);

      naviPush(RootNames.StackAddress, {
        screen: RootNames.AddressDetail,
        params: {
          address: currentAccount.address,
          type: currentAccount.type,
          brandName: currentAccount.brandName,
        },
      });
    }
  };

  return (
    <>
      <HeaderRightHistory />
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconSettingCC
          width={20}
          height={20}
          color={colors2024['neutral-title-1']}
        />
      </CustomTouchableOpacity>
    </>
  );
};
