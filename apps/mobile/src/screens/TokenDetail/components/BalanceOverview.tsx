import React from 'react';
import { View, Text } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatTokenAmount } from '@/utils/number';

interface Props {
  usdValue: string;
  amount: number;
}
const BalanceOverview: React.FC<Props> = ({ usdValue, amount }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <Text style={styles.amount}>{formatTokenAmount(amount)}</Text>
      <View style={styles.usdValueContainer}>
        <Text style={styles.usdValue}>≈${usdValue}</Text>
      </View>
    </View>
  );
};

export default BalanceOverview;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  amount: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  usdValue: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  percentChange: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  usdValueContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
}));
