import React, {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { FlatList, View, type ScrollViewProps } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { createGetStyles2024 } from '@/utils/styles';
import { usePerpsMarketCategoryConfigs } from '../../hooks/usePerpsGroupedMarketData';
import { PerpsMarketItem } from './PerpsMarketItem';
import { PerpsCategorySectionHeader } from './PerpsCategorySectionHeader';
import {
  createPerpsHomeRowsSelector,
  type PerpsHomeRow as HomeRow,
} from '../../hooks/perpsHomeRows';

export type PerpsMarketHomeListRef = {
  scrollToTop: () => void;
};

type Props = Pick<
  ScrollViewProps,
  'style' | 'contentContainerStyle' | 'onScroll' | 'refreshControl'
> & {
  onItemPress: (market: string) => void;
  listHeader?: React.ReactElement;
  listRef?: React.Ref<PerpsMarketHomeListRef>;
};

const keyExtractor = (row: HomeRow) => row.key;

const HomeMarketQuote = React.memo(function HomeMarketQuote({
  marketName,
  rank,
  onItemPress,
}: {
  marketName: string;
  rank?: number;
  onItemPress: Props['onItemPress'];
}) {
  const market = useActivityStore(perpsStore, s => s.marketDataMap[marketName]);
  const onPress = useMemoizedFn(() => onItemPress(marketName));
  // Membership and quotes converge from the same store snapshot. A removed
  // market may notify its row before the list drops it; never show stale data.
  return market ? (
    <PerpsMarketItem item={market} rank={rank} onPress={onPress} />
  ) : null;
});

const PerpsMarketHomeListComponent = React.memo(
  function PerpsMarketHomeListComponent({
    onItemPress,
    listHeader,
    listRef,
    ...scrollProps
  }: Props) {
    const { styles } = useTheme2024({ getStyle });
    const nativeRef = useRef<FlatList<HomeRow>>(null);
    useImperativeHandle(
      listRef,
      () => ({
        scrollToTop: () =>
          nativeRef.current?.scrollToOffset({ offset: 0, animated: true }),
      }),
      [],
    );
    const backendCategories = useActivityStore(perpsStore, s => s.categories);
    const configs = usePerpsMarketCategoryConfigs(backendCategories);
    const selectRows = useMemo(
      () => createPerpsHomeRowsSelector(configs),
      [configs],
    );
    const rows = useActivityStore(perpsStore, selectRows);
    const renderItem = useCallback(
      ({ item }: { item: HomeRow }) => {
        if (item.type === 'category') {
          return <PerpsCategorySectionHeader cfg={item.cfg} />;
        }
        return (
          <View
            style={[
              styles.cardRow,
              item.first && styles.cardFirstRow,
              item.last && styles.cardLastRow,
            ]}>
            <HomeMarketQuote
              marketName={item.marketName}
              rank={item.rank}
              onItemPress={onItemPress}
            />
          </View>
        );
      },
      [onItemPress, styles],
    );

    return (
      <FlatList
        {...scrollProps}
        ref={nativeRef}
        testID="perps-simple-list"
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={<View style={styles.footer} />}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={3}
        // Root translates the entire retained page. Do not let Android's
        // clipping heuristic detach cells using the page's translated bounds.
        removeClippedSubviews={false}
      />
    );
  },
);

export const PerpsMarketHomeList = React.memo(
  React.forwardRef<PerpsMarketHomeListRef, Omit<Props, 'listRef'>>(
    function PerpsMarketHomeList(props, ref) {
      const isFocused = useIsFocused();
      const parentScope = useStoreActivityScope();
      const parentActive = useSyncExternalStore(
        parentScope.subscribe,
        parentScope.getActive,
        parentScope.getActive,
      );
      return (
        <StoreActivityBoundary
          active={isFocused && parentActive}
          label="perps-market-home-list">
          <PerpsMarketHomeListComponent {...props} listRef={ref} />
        </StoreActivityBoundary>
      );
    },
  ),
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  cardRow: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-5'],
    backgroundColor: isLight
      ? 'rgba(255, 255, 255, 0.9)'
      : colors2024['neutral-bg-2'],
  },
  cardFirstRow: {
    borderTopWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  cardLastRow: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  footer: { height: 40 },
}));
