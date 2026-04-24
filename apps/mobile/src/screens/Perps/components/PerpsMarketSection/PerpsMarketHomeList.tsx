import React from 'react';
import { View } from 'react-native';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { usePerpsGroupedMarketData } from '../../hooks/usePerpsGroupedMarketData';
import { PerpsMarketItem } from './PerpsMarketItem';
import { PerpsCategorySectionHeader } from './PerpsCategorySectionHeader';
import { PerpsSearchInlineInput } from './PerpsSearchInlineInput';

type Props = {
  onItemPress: (market: string) => void;
};

const PerpsMarketHomeListComponent: React.FC<Props> = ({ onItemPress }) => {
  const marketData = perpsStore(s => s.marketData);
  const favoriteMarkets = perpsStore(s => s.favoriteMarkets);
  const backendCategories = perpsStore(s => s.categories);
  const { visibleHome } = usePerpsGroupedMarketData({
    marketData,
    favoriteMarkets,
    backendCategories,
  });

  return (
    <>
      {visibleHome.map((cat, catIdx) => (
        <View key={cat.id}>
          <PerpsCategorySectionHeader cfg={cat.cfg} />
          {cat.items.map((item, i) => (
            <PerpsMarketItem
              key={`${cat.id}-${item.name}`}
              item={item}
              rank={cat.cfg.showRankOnHome ? i + 1 : undefined}
              onPress={() => onItemPress(item.name)}
            />
          ))}
          {catIdx === 0 && <PerpsSearchInlineInput />}
        </View>
      ))}
    </>
  );
};

export const PerpsMarketHomeList = React.memo(PerpsMarketHomeListComponent);
