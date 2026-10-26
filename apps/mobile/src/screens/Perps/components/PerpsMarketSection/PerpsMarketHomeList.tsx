import React from 'react';
import { View } from 'react-native';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { ScreenStoreActivityProvider } from '@/hooks/storeActivity/ScreenStoreActivityProvider';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { createGetStyles2024 } from '@/utils/styles';
import { usePerpsGroupedMarketData } from '../../hooks/usePerpsGroupedMarketData';
import { PerpsMarketItem } from './PerpsMarketItem';
import { PerpsCategorySectionHeader } from './PerpsCategorySectionHeader';

type Props = {
  onItemPress: (market: string) => void;
};

const PerpsMarketHomeListComponent: React.FC<Props> = ({ onItemPress }) => {
  const { styles } = useTheme2024({ getStyle });
  const marketData = useActivityStore(perpsStore, s => s.marketData);
  const favoriteMarkets = useActivityStore(perpsStore, s => s.favoriteMarkets);
  const backendCategories = useActivityStore(perpsStore, s => s.categories);
  const { visibleHome } = usePerpsGroupedMarketData({
    marketData,
    favoriteMarkets,
    backendCategories,
  });

  return (
    <>
      {visibleHome.map(cat => (
        <View key={cat.id}>
          <PerpsCategorySectionHeader cfg={cat.cfg} />
          <View style={styles.card}>
            {cat.items.map((item, i) => (
              <PerpsMarketItem
                key={`${cat.id}-${item.name}`}
                item={item}
                rank={cat.cfg.showRankOnHome ? i + 1 : undefined}
                onPress={() => onItemPress(item.name)}
              />
            ))}
          </View>
        </View>
      ))}
    </>
  );
};

export const PerpsMarketHomeList = React.memo(function PerpsMarketHomeList(
  props: Props,
) {
  return (
    <ScreenStoreActivityProvider label="perps-market-home-list">
      <PerpsMarketHomeListComponent {...props} />
    </ScreenStoreActivityProvider>
  );
});

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-5'],
    backgroundColor: isLight
      ? 'rgba(255, 255, 255, 0.9)'
      : colors2024['neutral-bg-2'],
  },
}));
