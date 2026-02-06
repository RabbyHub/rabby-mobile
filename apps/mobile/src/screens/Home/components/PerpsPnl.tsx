import { usePerpsHomePnl } from '@/hooks/perps/usePerpsHomePnl';
import { useTheme2024 } from '@/hooks/theme';
import { useCurrency } from '@/hooks/useCurrency';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { useCurrentInnerDappTypeValue } from '@/hooks/useInnerDappValue';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { matomoRequestEvent } from '@/utils/analytics';
import { Text } from 'react-native-gesture-handler';
import { useEffect } from 'react';

const PerpsPnlByHyperliquid: React.FC<{}> = () => {
  const { perpsPositionInfo } = usePerpsHomePnl();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { formatCurrentCurrency } = useCurrency();
  const { type } = perpsPositionInfo;

  useEffect(() => {
    if (perpsPositionInfo.show) {
      matomoRequestEvent({
        category: 'Rabby Perps',
        action: 'Perps_ExistPosition',
      });
    }
  }, [perpsPositionInfo.show]);

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

const PerpsPnlByDapp: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { value } = useCurrentInnerDappTypeValue('PERPS');
  if (typeof value === 'undefined') {
    return null;
  }

  return <Text style={[styles.textValue]}>{formatUsdValue(value)}</Text>;
};

export const PerpsPnl = () => {
  const { perps } = useInnerDappSelection();
  if (perps === 'hyperliquid') {
    return <PerpsPnlByHyperliquid />;
  }
  return <PerpsPnlByDapp />;
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
  textValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
