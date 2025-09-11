import { usePerpsHomePnl } from '@/hooks/perps/usePerpsHomePnl';
import { useTheme2024 } from '@/hooks/theme';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native-gesture-handler';

export const PerpsPnl: React.FC<{}> = () => {
  const { perpsPositionInfo } = usePerpsHomePnl();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  return perpsPositionInfo.show ? (
    <Text
      style={[
        styles.text,
        perpsPositionInfo.pnl > 0 ? styles.green : styles.red,
      ]}>
      {perpsPositionInfo.pnl >= 0 ? '+' : '-'}$
      {splitNumberByStep(Math.abs(perpsPositionInfo.pnl).toFixed(2))}
    </Text>
  ) : null;
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
