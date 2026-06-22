import { usePerpsHomePnl } from '@/hooks/perps/usePerpsHomePnl';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { RNGHText as Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';

const PerpsPnlByHyperliquid: React.FC<{}> = () => {
  const { perpsPositionInfo } = usePerpsHomePnl();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { type } = perpsPositionInfo;

  return perpsPositionInfo.isLoading ? (
    <CustomSkeleton width={50} height={18} style={styles.skeleton} />
  ) : perpsPositionInfo.show ? (
    type === 'pnl' ? (
      <Text
        style={[
          styles.text,
          perpsPositionInfo.pnl > 0 ? styles.green : styles.red,
        ]}>
        {perpsPositionInfo.pnl >= 0 ? '+' : '-'}
        {formatUsdValue(Math.abs(perpsPositionInfo.pnl))}
      </Text>
    ) : Number(perpsPositionInfo.availableBalance) >= 0 ? (
      <Text style={styles.accountValue}>
        {formatUsdValue(perpsPositionInfo.availableBalance)}
      </Text>
    ) : null
  ) : null;
};

export const PerpsPnl = () => {
  return <PerpsPnlByHyperliquid />;
};
const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
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
  skeleton: {
    borderRadius: 8,
  },
  textValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
