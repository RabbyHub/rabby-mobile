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

export const RightMore: React.FC<HeaderButtonProps> = ({}) => {
  const { currentAccount } = useCurrentAccount();
  const showAddressDetail = useAddressDetailModal();
  const { styles, colors, colors2024 } = useTheme2024();
  const [pendingTxCount, setPendingTxCount] = useState(2);
  const timeRef = useRef<null | NodeJS.Timer>(null);
  const { navigation } = useSafeSetNavigationOptions();

  const fetchHistory = useCallback(() => {
    if (!currentAccount) {
      return;
    }
    const addresses = [currentAccount.address];
    const { pendingsLength } =
      transactionHistoryService.getPendingsAddresses(addresses);
    setPendingTxCount(2);
    timeRef.current && clearInterval(timeRef.current);
    timeRef.current = pendingsLength ? setInterval(fetchHistory, 5000) : null;
  }, [currentAccount]);

  const { switchSceneCurrentAccount, toggleUseAllAccountsOnScene } =
    useSwitchSceneCurrentAccount();

  const onPress = () => {
    if (currentAccount) {
      showAddressDetail({ account: currentAccount });
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  const openHistory = useCallback(async () => {
    // setHistoryVisible(true);
    // await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
    toggleUseAllAccountsOnScene('MultiHistory', false);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.History,
        params: {},
      }),
    );
  }, [navigation, toggleUseAllAccountsOnScene]);

  return (
    <>
      <CustomTouchableOpacity hitSlop={historyHitSlop} onPress={openHistory}>
        <View style={{ marginRight: 18 }}>
          {2 ? (
            <PendingTx number={2} onClick={openHistory} />
          ) : (
            <RcIconSwapHistory color={colors2024['neutral-body']} />
          )}
        </View>
      </CustomTouchableOpacity>
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconMore width={24} height={24} />
      </CustomTouchableOpacity>
    </>
  );
};
