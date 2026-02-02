import { useTheme2024 } from '@/hooks/theme';
import { useCurrentInnerDappTypeValue } from '@/hooks/useInnerDappValue';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native-gesture-handler';

export const PredictBadge: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { value } = useCurrentInnerDappTypeValue('PREDICTION');
  if (typeof value === 'undefined') {
    return null;
  }

  return <Text style={[styles.accountValue]}>{formatUsdValue(value)}</Text>;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  accountValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
