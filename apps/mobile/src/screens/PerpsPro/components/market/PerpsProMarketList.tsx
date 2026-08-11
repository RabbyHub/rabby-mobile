import { Text } from '@/components/Typography';
import type { MarketDataStatus } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetFlatList,
  type BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProMarketSlot } from '../../model/marketSelectorProjection';
import { PerpsProMarketSlotRow } from './PerpsProMarketSlotRow';

const PERPS_PRO_MARKET_ROW_HEIGHT = 70;
const PERPS_PRO_MARKET_TOP_THRESHOLD = 1;
const PERPS_PRO_MARKET_INITIAL_RENDER_COUNT = 10;
const PERPS_PRO_MARKET_MAX_RENDER_BATCH = 8;
const PERPS_PRO_MARKET_RENDER_BATCH_PERIOD = 16;
const PERPS_PRO_MARKET_WINDOW_SIZE = 3;

export type PerpsProMarketListHandle = {
  scrollToTopIfNeeded: () => boolean;
};

type PerpsProMarketListProps = {
  bottomInset: number;
  currentMarketKey: string | null;
  data: readonly PerpsProMarketSlot[];
  favoriteSet: ReadonlySet<string>;
  marketDataStatus: MarketDataStatus;
  onPrefetch?: (coin: string) => void;
  onSelect: (marketKey: string) => void;
  onToggleFavorite: (marketKey: string) => void;
};

const PerpsProMarketListComponent = forwardRef<
  PerpsProMarketListHandle,
  PerpsProMarketListProps
>(
  (
    {
      bottomInset,
      currentMarketKey,
      data,
      favoriteSet,
      marketDataStatus,
      onPrefetch,
      onSelect,
      onToggleFavorite,
    },
    ref,
  ) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const listRef = useRef<BottomSheetFlatListMethods>(null);
    const isAtTopRef = useRef(true);
    const listBottomStyle = useMemo<ViewStyle>(
      () => ({ paddingBottom: Math.max(16, bottomInset) }),
      [bottomInset],
    );
    const extraData = useMemo(
      () => ({ currentMarketKey, favoriteSet }),
      [currentMarketKey, favoriteSet],
    );

    const handleScrollPositionChange = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        isAtTopRef.current =
          event.nativeEvent.contentOffset.y <= PERPS_PRO_MARKET_TOP_THRESHOLD;
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToTopIfNeeded: () => {
          if (isAtTopRef.current || !listRef.current) {
            return false;
          }
          listRef.current.scrollToOffset({ animated: false, offset: 0 });
          isAtTopRef.current = true;
          return true;
        },
      }),
      [],
    );

    const getItemLayout = useCallback(
      (_: ArrayLike<PerpsProMarketSlot> | null | undefined, index: number) => ({
        index,
        length: PERPS_PRO_MARKET_ROW_HEIGHT,
        offset: PERPS_PRO_MARKET_ROW_HEIGHT * index,
      }),
      [],
    );

    const renderItem = useCallback<ListRenderItem<PerpsProMarketSlot>>(
      ({ item }) => {
        const selected = item.marketKey === currentMarketKey;
        return (
          <View style={selected ? styles.selectedMarket : undefined}>
            <PerpsProMarketSlotRow
              canonicalCoin={item.canonicalCoin}
              favorite={favoriteSet.has(item.canonicalCoin.toUpperCase())}
              marketKey={item.marketKey}
              onPrefetch={onPrefetch}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
              selected={selected}
            />
          </View>
        );
      },
      [
        currentMarketKey,
        favoriteSet,
        onPrefetch,
        onSelect,
        onToggleFavorite,
        styles.selectedMarket,
      ],
    );

    return (
      <BottomSheetFlatList<PerpsProMarketSlot>
        contentContainerStyle={[
          styles.listContent,
          listBottomStyle,
          data.length === 0 ? styles.emptyList : undefined,
        ]}
        data={data}
        extraData={extraData}
        getItemLayout={getItemLayout}
        initialNumToRender={PERPS_PRO_MARKET_INITIAL_RENDER_COUNT}
        keyboardShouldPersistTaps="handled"
        keyExtractor={item => item.slotKey}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {marketDataStatus === 'loading'
              ? t('page.perps.pro.marketSelector.loading')
              : t('page.perps.pro.marketSelector.empty')}
          </Text>
        }
        maxToRenderPerBatch={PERPS_PRO_MARKET_MAX_RENDER_BATCH}
        nestedScrollEnabled
        onMomentumScrollBegin={handleScrollPositionChange}
        onMomentumScrollEnd={handleScrollPositionChange}
        onScrollBeginDrag={handleScrollPositionChange}
        onScrollEndDrag={handleScrollPositionChange}
        ref={listRef}
        renderItem={renderItem}
        style={styles.list}
        updateCellsBatchingPeriod={PERPS_PRO_MARKET_RENDER_BATCH_PERIOD}
        windowSize={PERPS_PRO_MARKET_WINDOW_SIZE}
      />
    );
  },
);

PerpsProMarketListComponent.displayName = 'PerpsProMarketList';

export const PerpsProMarketList = React.memo(PerpsProMarketListComponent);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    flex: 1,
    marginHorizontal: 12,
  },
  listContent: {
    flexGrow: 0,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  selectedMarket: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 12,
    overflow: 'hidden',
  },
}));
