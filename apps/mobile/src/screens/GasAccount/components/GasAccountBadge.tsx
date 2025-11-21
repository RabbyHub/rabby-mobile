import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native';
import { formatUsdValue } from '@/utils/number';
import { useGasAccountInfo } from '../hooks';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export const GasAccountBadge: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { value, runFetchGasAccountInfo } = useGasAccountInfo();

  useFocusEffect(
    useCallback(() => {
      runFetchGasAccountInfo();
    }, [runFetchGasAccountInfo]),
  );

  if (!value?.account || !value?.account?.balance) {
    return null;
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
}));
