import React from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatAmountValueKMB } from '../util';
import { Text } from '@/components/Typography';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from './TokenPriceChart/LoadingLinear';

interface Props {
  usdValue: string;
  amount: number;
  status?: 'ready' | 'loading' | 'unavailable';
}
const BalanceOverview: React.FC<Props> = ({
  usdValue,
  amount,
  status = 'ready',
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <Skeleton
          testID="token-detail-amount-loading"
          width={181}
          height={42}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      ) : (
        <Text style={styles.amount}>
          {status === 'unavailable'
            ? '--'
            : formatAmountValueKMB(amount, 4, true)}
        </Text>
      )}
      <View style={styles.usdValueContainer}>
        {status === 'loading' ? (
          <Skeleton
            testID="token-detail-usd-loading"
            width={100}
            height={20}
            style={styles.skeleton}
            LinearGradientComponent={LoadingLinear}
          />
        ) : (
          <Text style={styles.usdValue}>
            {status === 'unavailable' ? '--' : `≈$${usdValue}`}
          </Text>
        )}
      </View>
    </View>
  );
};

export default BalanceOverview;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  skeleton: {
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  amount: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  usdValue: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  usdValueContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
}));
