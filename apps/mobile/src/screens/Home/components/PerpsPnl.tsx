import { usePerpsHomePnl } from '@/hooks/perps/usePerpsHomePnl';
import { useTheme2024 } from '@/hooks/theme';
import { useCurrency } from '@/hooks/useCurrency';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native-gesture-handler';

export const PerpsPnl: React.FC<{}> = () => {
  const { perpsPositionInfo } = usePerpsHomePnl();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { formatCurrentCurrency } = useCurrency();
  const { type } = perpsPositionInfo;
  return perpsPositionInfo.show ? (
    type === 'pnl' ? (
      <Text
        style={[
          styles.text,
          perpsPositionInfo.pnl > 0 ? styles.green : styles.red,
        ]}>
        {perpsPositionInfo.pnl >= 0 ? '+' : '-'}
        {formatCurrentCurrency(Math.abs(perpsPositionInfo.pnl))}
      </Text>
    ) : Number(perpsPositionInfo.accountValue) > 0 ? (
      <Text style={styles.accountValue}>
        {formatCurrentCurrency(perpsPositionInfo.accountValue)}
      </Text>
    ) : null
  ) : null;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  accountValue: {
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  green: {
    color: colors2024['green-default'],
  },
  red: {
    color: colors2024['red-default'],
  },
}));
