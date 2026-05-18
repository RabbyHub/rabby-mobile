import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { formatPerpsCoin } from '@/utils/perps';

export const PerpsDisplayCoinName: React.FC<{
  item?: MarketData;
  coin?: string;
}> = ({ item, coin = '' }) => {
  const { styles } = useTheme2024({ getStyle });
  if (!item && !coin) {
    return null;
  }
  const baseCoin = formatPerpsCoin(item?.displayName || item?.name || coin);
  const quoteCoin = item?.quoteAsset || 'USDC';

  return (
    <View style={styles.container}>
      <Text style={styles.base}>{baseCoin}</Text>
      <Text style={styles.quote}>/{quoteCoin}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
  },
  base: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  quote: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-info'],
  },
}));
