import {
  useFocusEffect,
  useIsFocused,
  useRoute,
} from '@react-navigation/native';
import React, { useCallback } from 'react';
import { BackHandler, Platform, View } from 'react-native';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useEnsurePerpsRuntime } from '@/hooks/perps/runtime/useEnsurePerpsRuntime';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useHideTipsPopup, useIsTipsPopupVisible } from '@/hooks/useTipsPopup';

import { PerpsProHistoryContent } from './components/PerpsProHistoryContent';
import type { PerpsProHistoryTab } from './types';
import { PERPS_PRO_HISTORY_FEE_TIPS_OWNER } from './constants';

const isHistoryTab = (value: unknown): value is PerpsProHistoryTab =>
  value === 'orders' ||
  value === 'trade' ||
  value === 'transaction' ||
  value === 'funding';

export const PerpsProHistoryScreen = () => {
  useEnsurePerpsRuntime();
  const isFocused = useIsFocused();
  const hideFeeTipsPopup = useHideTipsPopup(PERPS_PRO_HISTORY_FEE_TIPS_OWNER);
  const isFeeTipsPopupVisible = useIsTipsPopupVisible(
    PERPS_PRO_HISTORY_FEE_TIPS_OWNER,
  );
  const { styles } = useTheme2024({ getStyle });
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'PerpsProHistory'
      >
    >();
  const initialTab = isHistoryTab(route.params?.initialTab)
    ? route.params.initialTab
    : 'orders';
  useFocusEffect(
    useCallback(() => () => hideFeeTipsPopup(), [hideFeeTipsPopup]),
  );
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !isFeeTipsPopupVisible) {
        return undefined;
      }
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          hideFeeTipsPopup();
          return true;
        },
      );
      return () => subscription.remove();
    }, [hideFeeTipsPopup, isFeeTipsPopupVisible]),
  );

  return (
    <NormalScreenContainer2024 type="bg1">
      <View style={styles.container}>
        <PerpsProHistoryContent active={isFocused} initialTab={initialTab} />
      </View>
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
}));

export type { PerpsProHistoryTab } from './types';
