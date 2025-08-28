import React, { useMemo } from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import { formatPrice, formatUsdValue } from '@/utils/number';

const MarketInfo = ({
  price,
  price24hChange,
  marketCap,
  totalSupply,
  volume24h,
  txns24h,
  holders,
}: {
  price: number;
  price24hChange: number;
  marketCap: string;
  totalSupply: string;
  volume24h: string;
  txns24h: string;
  holders: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const currentIsLoss = price24hChange < 0;
  const percentChangeText = useMemo(() => {
    const changeValue = formatUsdValue(price24hChange * price);
    const formatPercent = price24hChange
      ? Math.abs((price24hChange || 0) * 100).toFixed(2) + '%'
      : '';
    return `${formatPercent}(${changeValue})`;
  }, [price24hChange, price]);
  return (
    <View style={styles.container}>
      <View style={styles.priceContainer}>
        <Text style={styles.priceValue}>{formatPrice(price)}</Text>
        <View style={styles.priceChangeContainer}>
          <Text
            style={[
              styles.priceChangeValue,
              {
                color: currentIsLoss
                  ? colors2024['red-default']
                  : colors2024['green-default'],
              },
            ]}>
            {percentChangeText}
          </Text>
        </View>
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <Text style={styles.infoItemText}>Market Cap</Text>
          <Text style={styles.infoItemValue}>{marketCap}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoItemText}>Total Supply</Text>
          <Text style={styles.infoItemValue}>{totalSupply}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoItemText}>24h Volume</Text>
          <Text style={styles.infoItemValue}>{formatUsdValue(volume24h)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoItemText}>24h Txns</Text>
          <Text style={styles.infoItemValue}>{txns24h}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoItemText}>Holders</Text>
          <Text style={styles.infoItemValue}>{holders}</Text>
        </View>
      </View>
    </View>
  );
};

export default MarketInfo;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  infoContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  infoItem: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  infoItemText: {
    fontSize: 10,
    lineHeight: 14,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
  },
  infoItemValue: {
    fontSize: 10,
    lineHeight: 14,
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  priceValue: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
  },
  priceChangeContainer: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  priceChangeValue: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    position: 'relative',
  },
  priceChangeBalance: {},
}));
