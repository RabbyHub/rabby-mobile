/* eslint-disable react-native/no-inline-styles */
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RcIconMore } from '@/assets/icons/home';
import { useAddressDetailModal } from '../Address/useAddressDetailModal';
import RcIconHistory from '@/assets2024/singleHome/history.svg';
import { useTheme2024 } from '@/hooks/theme';
import { transactionHistoryService } from '@/core/services';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { View } from 'react-native';
import { AbstractPortfolioToken } from './types';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';
import { HomePendingBadge } from './components/HomePending';
import { Account } from '@/core/services/preference';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { foldChartAtom } from './Home';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

const historyHitSlop = {
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};

interface HeaderRightHistoryProps {
  isInTokenDetail?: boolean;
  isMultiAddress?: boolean;
  tokenItem?: AbstractPortfolioToken;
  account: Account;
}

export const refreshHistoryIdAtom = atom(0);

export const HeaderRightHistory: React.FC<HeaderRightHistoryProps> = ({
  isInTokenDetail,
  isMultiAddress,
  tokenItem,
  account: currentAccount,
}) => {
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const timeRef = useRef<null | ReturnType<typeof setInterval>>(null);
  const { navigation } = useSafeSetNavigationOptions();
  const { colors2024 } = useTheme2024();
  const [historyCount, setHistoryCount] = useState<{
    success: number;
    fail: number;
  }>();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const setFoldChart = useSetAtom(foldChartAtom);

  const fetchHistory = useCallback(() => {
    if (!currentAccount) {
      return;
    }

    const failCount = transactionHistoryService.getFailedCount(
      currentAccount.address,
    );
    const successCount = transactionHistoryService.getSucceedCount(
      currentAccount.address,
    );
    setHistoryCount({
      success: successCount,
      fail: failCount,
    });

    if (tokenItem) {
      // single token no pending tx
      return;
    }

    if (!currentAccount) {
      return;
    }
    const addresses = [currentAccount.address];
    const { pendingsLength } =
      transactionHistoryService.getPendingsAddresses(addresses);
    setPendingTxCount(pendingsLength);
    timeRef.current && clearInterval(timeRef.current);
    timeRef.current = pendingsLength ? setInterval(fetchHistory, 5000) : null;
  }, [currentAccount, tokenItem]);

  const refreshId = useAtomValue(refreshHistoryIdAtom);
  useEffect(() => {
    if (refreshId > 0) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshId]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  const openHistory = useCallback(async () => {
    setFoldChart(true);
    await switchSceneCurrentAccount('History', currentAccount);
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
    setFoldChart,
    switchSceneCurrentAccount,
    currentAccount,
    navigation,
    isMultiAddress,
    isInTokenDetail,
    tokenItem,
  ]);

  return (
    <CustomTouchableOpacity hitSlop={historyHitSlop} onPress={openHistory}>
      {pendingTxCount > 0 ? (
        <View
          style={{ marginRight: 16, position: 'relative', paddingVertical: 4 }}>
          <HomePendingBadge number={pendingTxCount} />
        </View>
      ) : (
        <View
          style={{ marginRight: 16, position: 'relative', paddingVertical: 4 }}>
          <RcIconHistory
            color={colors2024['neutral-body']}
            width={22}
            height={22}
          />
          {Boolean(historyCount?.success || historyCount?.fail) && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  colors2024[
                    historyCount?.fail ? 'red-default' : 'green-default'
                  ],
                position: 'absolute',
                top: 0,
                right: -4,
              }}
            />
          )}
        </View>
      )}
    </CustomTouchableOpacity>
  );
};

export const RightArea: React.FC<{
  account: Account;
}> = ({ account: currentAccount }) => {
  const showAddressDetail = useAddressDetailModal();
  const { navigation } = useSafeSetNavigationOptions();
  const { colors2024 } = useTheme2024();
  const { t } = useTranslation();
  const setFoldChart = useSetAtom(foldChartAtom);

  const onPress = () => {
    if (currentAccount) {
      setFoldChart(true);
      showAddressDetail({
        account: currentAccount,
        onDelete: () => {
          toast.success(t('global.Deleted'));
          navigation?.canGoBack() && navigation.goBack();
        },
      });
    }
  };

  return (
    <>
      <HeaderRightHistory account={currentAccount} />
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconMore width={24} height={24} color={colors2024['neutral-body']} />
      </CustomTouchableOpacity>
    </>
  );
};
