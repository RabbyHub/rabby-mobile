import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';

const MarketInfo = ({
  marketCap,
  totalSupply,
  volume24h,
  txns24h,
  holders,
}: {
  marketCap: string;
  totalSupply: string;
  volume24h: string;
  txns24h: string;
  holders: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.text}>
      <View>
        <Text>Market Cap</Text>
        <Text>{marketCap}</Text>
      </View>
      <View>
        <Text>Total Supply</Text>
        <Text>{totalSupply}</Text>
      </View>
      <View>
        <Text>24h Volume</Text>
        <Text>{volume24h}</Text>
      </View>
      <View>
        <Text>24h Txns</Text>
        <Text>{txns24h}</Text>
      </View>
      <View>
        <Text>Holders</Text>
        <Text>{holders}</Text>
      </View>
    </View>
  );
};

export default MarketInfo;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  text: {
    position: 'relative',
    color: colors2024['red-default'],
  },
}));
