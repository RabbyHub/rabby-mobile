import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Spin } from '@/screens/TransactionRecord/components/Spin';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RcIconHeaderSettings,
  RcIconHistory,
  RcIconHeaderRightArrow,
} from '@/assets/icons/home';
import { useCurrentAccount } from '@/hooks/account';
import { useInterval, useRequest } from 'ahooks';
import { transactionHistoryService } from '@/core/services';

export const PendingTxCount = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { currentAccount } = useCurrentAccount();
  const { data: count, runAsync: runGetPendingCount } = useRequest(
    async () => {
      return currentAccount?.address
        ? transactionHistoryService.getPendingCount(currentAccount?.address)
        : 0;
    },
    {
      refreshDeps: [currentAccount?.address],
    },
  );

  useInterval(() => {
    runGetPendingCount();
  }, 5000);

  return count ? (
    <View style={styles.container}>
      <Spin color={colors['blue-default']} style={styles.spin} />
      <Text style={styles.count}>{count > 9 ? 9 : count}</Text>
    </View>
  ) : (
    <RcIconHistory style={styles.actionIcon} />
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      width: 24,
      height: 24,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    spin: {
      width: 20,
      height: 20,
    },
    count: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      textAlign: 'center',
      color: colors['blue-default'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 24,
    },
    actionIcon: {
      width: 24,
      height: 24,
    },
  });
