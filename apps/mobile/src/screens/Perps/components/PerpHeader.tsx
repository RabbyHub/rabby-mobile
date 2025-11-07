import React, {
  useCallback,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
// import { RcIconSwapHistory } from '@/assets/icons/swap';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import PendingTx from '@/screens/Bridge/components/PendingTx';
import { AccountHistoryItem } from '@/hooks/perps/usePerpsStore';
import { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['green-default'],
    position: 'absolute',
    top: 0,
    right: 0,
  },
  iconContainer: {
    position: 'relative',
    padding: 4,
  },
}));

export const PerpHeader: React.FC<{
  localLoadingHistory: AccountHistoryItem[];
}> = ({ localLoadingHistory }) => {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();
  const loadingNumber = useMemo(
    () => localLoadingHistory.filter(item => item.status === 'pending').length,
    [localLoadingHistory],
  );

  const openHistory = useCallback(() => {
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.PerpsHistory,
    });
  }, [navigation]);

  return (
    <>
      <View style={styles.container}>
        {loadingNumber ? (
          <PendingTx number={loadingNumber} onClick={openHistory} />
        ) : (
          <TouchableOpacity onPress={openHistory} style={styles.iconContainer}>
            <RcIconSwapHistory color={colors2024['neutral-body']} />
            {/* not very accurate */}
            {/* {Boolean(showRedDot) && <View style={styles.greenDot} />} */}
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};
