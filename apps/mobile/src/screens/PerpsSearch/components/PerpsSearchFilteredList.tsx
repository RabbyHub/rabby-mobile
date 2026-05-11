import React, { useCallback, useMemo } from 'react';
import { FlatList, Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { formatPerpsCoin, formatPerpsDisplayName } from '@/utils/perps';
import { PerpsMarketItem } from '../../Perps/components/PerpsMarketSection/PerpsMarketItem';
import IconEmptyDefi from '@/assets2024/singleHome/empty-defi.png';
import IconEmptyDefiDark from '@/assets2024/singleHome/empty-defi-dark.png';

export const PerpsSearchFilteredList: React.FC<{
  query: string;
  marketData: MarketData[];
  onSelect: (coin: string) => void;
}> = ({ query, marketData, onSelect }) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const list = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) {
      return [];
    }
    return marketData.filter(item => {
      const baseCoin = formatPerpsCoin(item.name).toUpperCase();
      const fullPair = formatPerpsDisplayName(
        item.displayName,
        item.quoteAsset,
      ).toUpperCase();
      return (
        baseCoin.includes(q) ||
        fullPair.includes(q) ||
        item.quoteAsset?.toUpperCase().includes(q)
      );
    });
  }, [query, marketData]);

  const renderItem = useCallback(
    ({ item }: { item: MarketData }) => (
      <PerpsMarketItem item={item} onPress={() => onSelect(item.name)} />
    ),
    [onSelect],
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={item => `search-${item.name}`}
      keyboardShouldPersistTaps="handled"
      renderItem={renderItem}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Image
            source={isLight ? IconEmptyDefi : IconEmptyDefiDark}
            style={styles.emptyImage}
          />
          <Text style={styles.emptyText}>{t('page.perps.search.empty')}</Text>
        </View>
      }
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 24 },
  empty: {
    paddingTop: 120,
    alignItems: 'center',
  },
  emptyImage: { width: 163, height: 126, marginBottom: 16 },
  emptyText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-info'],
  },
}));
