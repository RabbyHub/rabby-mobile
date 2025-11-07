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

  return iUserSummary?.healthFactor && Number(iUserSummary.healthFactor) > 0 ? (
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
  ) : null;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    position: 'relative',
    right: -4,
    paddingTop: 4,
    alignSelf: 'flex-start',
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
}));
