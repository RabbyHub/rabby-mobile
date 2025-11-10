import { useTheme2024 } from '@/hooks/theme';
import { useLendingData, useLendingSummary } from '@/screens/Lending/hooks';
import { getHealthStatusColor } from '@/screens/Lending/utils';
import { formatNum } from '@/utils/math';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native';

export const LendingHF: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  useLendingData(true);
  const { iUserSummary } = useLendingSummary();

  if (
    !iUserSummary?.healthFactor ||
    Number(iUserSummary.healthFactor) <= 0 ||
    Number(iUserSummary.healthFactor) >= 3
  ) {
    return null;
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
    fontFamily: 'SF Pro Display',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  green: {
    color: colors2024['green-default'],
  },
  red: {
    color: colors2024['red-default'],
  },
}));
