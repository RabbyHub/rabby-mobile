import { Text, View } from 'react-native';
import { useGasAccountInfo } from '../hooks';
import { formatTokenAmount } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { RcIconGasAccount } from '@/assets/icons/gas-account';
import { useThemeColors } from '@/hooks/theme';
import { useMemo } from 'react';

const formatUsdValue = (usd: string | number) => {
  const v = Number(usd);
  if (v >= 1000) {
    return `$${formatTokenAmount(Number(v).toFixed(0), 0)}`;
  }
  if (v >= 100) {
    return `$${Number(v).toFixed(1)}`;
  }
  return `$${Number(v).toFixed(2)}`;
};

export const GasAccountDashBoardHeader = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { value } = useGasAccountInfo();

  const usd = useMemo(() => {
    if (value && 'account' in value) {
      return formatUsdValue(value.account.balance);
    }
    return formatUsdValue(0);
  }, [value]);

  return (
    <View style={styles.wrapper}>
      <RcIconGasAccount width={16} height={16} />
      <Text style={styles.usd}>{usd}</Text>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  wrapper: {
    gap: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 4,
    height: 40,
    paddingHorizontal: 8,
  },
  usd: {
    color: colors['neutral-foot'],
    fontSize: 13,
    fontWeight: '500',
  },
}));
