import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValue } from '@/utils/number';
import { useGasAccountBalanceWithPendingHardware } from '../hooks/useGasAccountBalanceWithPendingHardware';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';

export const GasAccountBadge: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const {
    isLogin,
    pendingHardwareAddress,
    runFetchGasAccountInfo,
    refreshPendingHardwareGasAccountInfo,
    displayBalance,
    isDisplayBalanceLoading,
  } = useGasAccountBalanceWithPendingHardware();

  useFocusEffect(
    useCallback(() => {
      if (isLogin) {
        runFetchGasAccountInfo();
        return;
      }
      if (pendingHardwareAddress) {
        refreshPendingHardwareGasAccountInfo();
      }
    }, [
      isLogin,
      pendingHardwareAddress,
      refreshPendingHardwareGasAccountInfo,
      runFetchGasAccountInfo,
    ]),
  );

  if (isDisplayBalanceLoading) {
    return <CustomSkeleton width={50} height={18} style={styles.skeleton} />;
  }

  if (displayBalance >= 1) {
    return null;
  }

  if (displayBalance < 0.1) {
    return (
      <Text style={styles.invalidText}>{formatUsdValue(displayBalance)}</Text>
    );
  }

  return <Text style={styles.text}>{formatUsdValue(displayBalance)}</Text>;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  invalidText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['orange-default'],
  },
  skeleton: {
    borderRadius: 8,
  },
}));
