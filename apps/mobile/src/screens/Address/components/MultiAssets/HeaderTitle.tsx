import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';

interface IProps {
  netWorth: string;
  changePercent: string;
  change?: string;
  isLoss?: boolean;
}
export const HeaderTitle = ({
  netWorth,
  change,
  changePercent,
  isLoss,
}: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.container}>
      <Text style={styles.netWorth}>{netWorth}</Text>
      <Text
        style={[styles.changePercent, isLoss ? styles.changePercentLoss : {}]}>
        {changePercent}
      </Text>
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
    gap: 4,
    width: '100%',
  },
  netWorth: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  changeValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changePercentLoss: {
    color: colors2024['red-default'],
  },
}));
