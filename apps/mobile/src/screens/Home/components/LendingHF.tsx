import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { useTheme2024 } from '@/hooks/theme';
import { apisLending, useLendingHF } from '@/screens/Lending/hooks';
import { getHealthStatusColor } from '@/screens/Lending/utils';
import { formatNum } from '@/utils/math';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useEffect } from 'react';
import { Text } from '@/components/Typography';
import { BALANCE_HIDE_TYPE, useHideBalance } from '../hooks/useHideBalance';

const NetWorthBadge: React.FC<{ netWorth: string; isHidden: boolean }> = ({
  netWorth,
  isHidden,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  if (Number(netWorth) <= 0) {
    return null;
  }
  return (
    <Text style={styles.netWorthText}>
      {isHidden ? '****' : formatUsdValue(netWorth)}
    </Text>
  );
};

export const LendingHF: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { lendingHf } = useLendingHF();
  const [hideType] = useHideBalance();
  const isHidden = hideType === BALANCE_HIDE_TYPE.HIDE;

  useRendererDetect({ name: 'LendingHF' });

  useEffect(() => {
    if (lendingHf) {
      return;
    }
    const timer = setTimeout(() => {
      apisLending.fetchLendingData();
    }, 200);
    return () => {
      timer && clearTimeout(timer);
    };
  }, [lendingHf]);

  if (
    !lendingHf?.healthFactor ||
    Number(lendingHf.healthFactor) <= 0 ||
    Number(lendingHf.healthFactor) >= 3
  ) {
    return (
      <NetWorthBadge
        netWorth={lendingHf?.netWorthUSD || '0'}
        isHidden={isHidden}
      />
    );
  }
  if (isHidden) {
    return <Text style={styles.netWorthText}>****</Text>;
  }
  return (
    <Text
      style={[
        styles.text,
        {
          color: getHealthStatusColor(Number(lendingHf.healthFactor || '0'))
            .color,
        },
      ]}>
      {formatNum(lendingHf.healthFactor)}
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
  netWorthText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
