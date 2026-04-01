import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValue } from '@/utils/number';
import { useGasAccountInfo } from '../hooks';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';

export const GasAccountBadge: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { value, runFetchGasAccountInfo, loading } = useGasAccountInfo();

  useFocusEffect(
    useCallback(() => {
      runFetchGasAccountInfo();
    }, [runFetchGasAccountInfo]),
  );

  if (!value && loading) {
    return (
      <CustomSkeleton width={50} height={18} style={{ borderRadius: 8 }} />
    );
  }

  if (
    !value?.account ||
    !value?.account?.balance ||
    value?.account?.balance < 0.1
  ) {
    return (
      <Text style={styles.invalidText}>
        {formatUsdValue(value?.account?.balance || 0)}
      </Text>
    );
  }

  return (
    <Text style={styles.text}>{formatUsdValue(value.account.balance)}</Text>
  );
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
}));
