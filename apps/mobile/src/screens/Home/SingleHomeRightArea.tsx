/* eslint-disable react-native/no-inline-styles */
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { HeaderButtonProps } from '@react-navigation/native-stack/lib/typescript/src/types';
import React, { useCallback, useRef, useState } from 'react';
import { RcIconMore } from '@/assets/icons/home';
import { useAddressDetailModal } from '../Address/useAddressDetailModal';
import { useCurrentAccount } from '@/hooks/account';
import PendingTx from '../Bridge/components/PendingTx';
import RcIconSwapHistory from '@/assets2024/icons/bridge/IconTopHistory.svg';
import { useTheme2024 } from '@/hooks/theme';
import { transactionHistoryService } from '@/core/services';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { View } from 'react-native';

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
}

export const HeaderRightHistory: React.FC<HeaderRightHistoryProps> = ({
  isInTokenDetail,
  isMultiAddress,
}) => {
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const timeRef = useRef<null | NodeJS.Timer>(null);
  const { navigation } = useSafeSetNavigationOptions();
  const { colors2024 } = useTheme2024();
  const { currentAccount } = useCurrentAccount();

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const fetchHistory = useCallback(() => {
    if (!currentAccount) {
      return;
    }
    const addresses = [currentAccount.address];
    const { pendingsLength } =
      transactionHistoryService.getPendingsAddresses(addresses);
    setPendingTxCount(pendingsLength);
    timeRef.current && clearInterval(timeRef.current);
    timeRef.current = pendingsLength ? setInterval(fetchHistory, 5000) : null;
  }, [currentAccount]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  const openHistory = useCallback(async () => {
    await switchSceneCurrentAccount('History', currentAccount);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.History,
        params: {
          isInTokenDetail,
          isMultiAddress,
        },
      }),
    );
  }, [
    navigation,
    switchSceneCurrentAccount,
    currentAccount,
    isInTokenDetail,
    isMultiAddress,
  ]);

  return (
    <CustomTouchableOpacity hitSlop={historyHitSlop} onPress={openHistory}>
      <View style={{ marginRight: 18 }}>
        {pendingTxCount ? (
          <PendingTx number={pendingTxCount} onClick={openHistory} />
        ) : (
          <RcIconSwapHistory color={colors2024['neutral-body']} />
        )}
      </View>
    </CustomTouchableOpacity>
  );
};

export const RightArea: React.FC<HeaderButtonProps> = ({}) => {
  const { currentAccount } = useCurrentAccount();
  const showAddressDetail = useAddressDetailModal();

  const onPress = () => {
    if (currentAccount) {
      showAddressDetail({ account: currentAccount });
    }
  };

  return (
    <>
      <HeaderRightHistory />
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconMore width={24} height={24} />
      </CustomTouchableOpacity>
    </>
  );
};
