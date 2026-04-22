import React, { useCallback } from 'react';
import { Tabs } from 'react-native-collapsible-tab-view';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { PerpsCategoryId } from '../../Perps/constants/perpsCategories';
import { PerpsMarketItem } from '../../Perps/components/PerpsMarketSection/PerpsMarketItem';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const PerpsSearchTabContent: React.FC<{
  categoryId: PerpsCategoryId;
  items: MarketData[];
  showRank: boolean;
  onSelect: (coin: string) => void;
}> = ({ categoryId, items, showRank, onSelect }) => {
  const { styles } = useTheme2024({ getStyle });

  const renderItem = useCallback(
    ({ item, index }: { item: MarketData; index: number }) => (
      <PerpsMarketItem
        item={item}
        rank={showRank ? index + 1 : undefined}
        onPress={() => onSelect(item.name)}
      />
    ),
    [showRank, onSelect],
  );

  return (
    <Tabs.FlatList
      data={items}
      keyExtractor={item => `${categoryId}-${item.name}`}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
    />
  );
};

const getStyle = createGetStyles2024(() => ({
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
}));
