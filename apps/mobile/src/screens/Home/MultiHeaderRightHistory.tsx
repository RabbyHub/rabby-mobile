import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import { StackActions } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

import { HeaderRightHistoryButton } from './components/HeaderRightHistoryButton';
import { useHomeHistoryCount, useHomePendingTxCount } from './hooks/history';

interface MultiHeaderRightHistoryProps {
  style?: StyleProp<ViewStyle>;
}
export const MultiHeaderRightHistory = ({
  style,
}: MultiHeaderRightHistoryProps) => {
  const pendingTxCount = useHomePendingTxCount();
  const historyCount = useHomeHistoryCount();
  const { navigation } = useSafeSetNavigationOptions();

  const openHistory = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation?.();
      storeApiAccountsSwitcher.toggleUseAllAccountsOnScene(
        'MultiHistory',
        true,
      );
      navigation.dispatch(
        StackActions.push(RootNames.StackTransaction, {
          screen: RootNames.MultiAddressHistory,
          params: {},
        }),
      );
    },
    [navigation],
  );

  return (
    <HeaderRightHistoryButton
      pendingTxCount={pendingTxCount}
      historyCount={historyCount}
      onPress={openHistory}
      style={style}
      rightSpace={0}
    />
  );
};
