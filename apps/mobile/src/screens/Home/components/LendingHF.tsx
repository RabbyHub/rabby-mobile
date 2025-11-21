import { useTheme2024 } from '@/hooks/theme';
import { useLendingData, useLendingSummary } from '@/screens/Lending/hooks';
import { getHealthStatusColor } from '@/screens/Lending/utils';
import { formatNetworth, formatNum } from '@/utils/math';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native';

const NetWorthBadge: React.FC<{ netWorth: string }> = ({ netWorth }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  if (Number(netWorth) <= 0) {
    return null;
  }
  return (
    <Text style={styles.netWorthText}>{formatNetworth(Number(netWorth))}</Text>
  );
};

export const LendingHF: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  useLendingData(true);
  const { iUserSummary } = useLendingSummary();

  if (
    !iUserSummary?.healthFactor ||
    Number(iUserSummary.healthFactor) <= 0 ||
    Number(iUserSummary.healthFactor) >= 3
  ) {
    return <NetWorthBadge netWorth={iUserSummary?.netWorthUSD || '0'} />;
  }
  return (
    <Text
      style={[
        styles.text,
        {
          color: getHealthStatusColor(Number(iUserSummary.healthFactor || '0'))
            .color,
        },
      ]}>
      {formatNum(iUserSummary.healthFactor)}
    </Text>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  green: {
    color: colors2024['green-default'],
  },
  red: {
    color: colors2024['red-default'],
  },
  netWorthText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
