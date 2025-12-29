import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { rtConverter, runOnComputeRt } from '@/core/perf/runtime';
import { useTheme2024 } from '@/hooks/theme';
import { apisLending, useLendingHF } from '@/screens/Lending/hooks';
import { getHealthStatusColor } from '@/screens/Lending/utils';
import { formatNetworth, formatNum } from '@/utils/math';
import { createGetStyles2024 } from '@/utils/styles';
import { useFocusEffect } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect } from 'react';
import { Text } from 'react-native';
import { runOnJS, runOnUI, useSharedValue } from 'react-native-reanimated';

const NetWorthBadge: React.FC<{ netWorth: string }> = ({ netWorth }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  if (Number(netWorth) <= 0) {
    return null;
  }
  return (
    <Text style={styles.netWorthText}>{formatNetworth(Number(netWorth))}</Text>
  );
};

const consoleFromUI = {
  debug: ((...args) => {
    'worklet';
    runOnJS(console.debug)(...args);
  }) as typeof console.debug,
};

export const LendingHF: React.FC<{}> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { lendingHf } = useLendingHF();

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
    return <NetWorthBadge netWorth={lendingHf?.netWorthUSD || '0'} />;
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
