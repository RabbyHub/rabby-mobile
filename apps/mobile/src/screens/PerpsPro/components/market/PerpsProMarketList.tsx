import { PerpsProEmptyIllustration } from '../common/PerpsProEmptyIllustration';
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
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type EffectCallback,
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
import type { PerpsProMarketTab } from '../../model/market';
import { PERPS_PRO_MARKET_ITEM_HEIGHT } from './marketLayout';
import { PerpsProMarketSlotRow } from './PerpsProMarketSlotRow';

const PERPS_PRO_MARKET_TOP_THRESHOLD = 1;
const PERPS_PRO_MARKET_RENDER_BATCH_PERIOD = 16;
export type PerpsProMarketListRenderProfile = 'active' | 'prepared';

const PERPS_PRO_MARKET_RENDER_PROFILES: Record<
  PerpsProMarketListRenderProfile,
  Readonly<{
    initialNumToRender: number;
    maxToRenderPerBatch: number;
    windowSize: number;
  }>
> = {
  active: {
    initialNumToRender: 12,
    maxToRenderPerBatch: 16,
    windowSize: 5,
  },
  prepared: {
    initialNumToRender: 10,
    maxToRenderPerBatch: 8,
    windowSize: 3,
  },
};
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
  onRealtimeIntentCancel?: (marketKey: string) => void;
  onRealtimeIntentStart?: (marketKey: string) => void;
  onSelect: (marketKey: string) => void;
  onToggleFavorite: (marketKey: string) => void;
  pageTab: PerpsProMarketTab | 'search';
  renderProfile: PerpsProMarketListRenderProfile;
  searchMode: boolean;
  /**
   * The sheet can only track one scrollable. Mark the visible page so it is the
   * only one registered with the bottom sheet; the rest keep their own scroll
   * state without stealing the sheet's content-panning gesture.
   */
  isActive?: boolean;
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
      onRealtimeIntentCancel,
      onRealtimeIntentStart,
      onSelect,
      onToggleFavorite,
      pageTab,
      renderProfile,
      searchMode,
      isActive = true,
    },
    ref,
  ) => {
    const { isLight, styles } = useTheme2024({ getStyle });
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
    const renderConfig = PERPS_PRO_MARKET_RENDER_PROFILES[renderProfile];

    // `@gorhom/bottom-sheet` documents this hook for sheets that host several
    // scrollables: it decides which list the sheet reads for scroll position and
    // drag hand-off. Registering only the visible page keeps "list at top then
    // keep dragging" working across tab switches without patching the library.
    const focusHook = useCallback(
      (effect: EffectCallback) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- gorhom calls
        // this with a stable effect, mirroring its default `useEffect`.
        useEffect(() => (isActive ? effect() : undefined), [isActive, effect]);
      },
      [isActive],
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
        length: PERPS_PRO_MARKET_ITEM_HEIGHT,
        offset: PERPS_PRO_MARKET_ITEM_HEIGHT * index,
      }),
      [],
    );

    const renderItem = useCallback<ListRenderItem<PerpsProMarketSlot>>(
      ({ item }) => {
        const selected = item.marketKey === currentMarketKey;
        return (
          <PerpsProMarketSlotRow
            canonicalCoin={item.canonicalCoin}
            favorite={favoriteSet.has(item.canonicalCoin.toUpperCase())}
            marketKey={item.marketKey}
            onPrefetch={onPrefetch}
            onRealtimeIntentCancel={onRealtimeIntentCancel}
            onRealtimeIntentStart={onRealtimeIntentStart}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            selected={selected}
          />
        );
      },
      [
        currentMarketKey,
        favoriteSet,
        onPrefetch,
        onRealtimeIntentCancel,
        onRealtimeIntentStart,
        onSelect,
        onToggleFavorite,
      ],
    );
    const isSearchEmpty =
      searchMode && marketDataStatus !== 'loading' && data.length === 0;

    return (
      <BottomSheetFlatList<PerpsProMarketSlot>
        contentContainerStyle={[
          styles.listContent,
          listBottomStyle,
          searchMode ? styles.searchListContent : undefined,
          data.length === 0 && !isSearchEmpty ? styles.emptyList : undefined,
        ]}
        data={data}
        extraData={extraData}
        focusHook={focusHook}
        getItemLayout={getItemLayout}
        initialNumToRender={renderConfig.initialNumToRender}
        keyboardShouldPersistTaps="handled"
        keyExtractor={item => item.slotKey}
        ListEmptyComponent={
          isSearchEmpty ? (
            <View
              style={styles.searchEmpty}
              testID="perps-pro-market-search-empty">
              <PerpsProEmptyIllustration
                isLight={isLight}
                testID={`perps-pro-market-search-empty-${
                  isLight ? 'light' : 'dark'
                }`}
              />
              <Text style={styles.searchEmptyText}>
                {t('page.perps.pro.marketSelector.empty')}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {marketDataStatus === 'loading'
                ? t('page.perps.pro.marketSelector.loading')
                : t('page.perps.pro.marketSelector.empty')}
            </Text>
          )
        }
        maxToRenderPerBatch={renderConfig.maxToRenderPerBatch}
        nestedScrollEnabled
        onMomentumScrollBegin={handleScrollPositionChange}
        onMomentumScrollEnd={handleScrollPositionChange}
        onScrollBeginDrag={handleScrollPositionChange}
        onScrollEndDrag={handleScrollPositionChange}
        ref={listRef}
        renderItem={renderItem}
        style={styles.list}
        testID={`perps-pro-market-flat-list-${pageTab}`}
        updateCellsBatchingPeriod={PERPS_PRO_MARKET_RENDER_BATCH_PERIOD}
        windowSize={renderConfig.windowSize}
      />
    );
  },
);

PerpsProMarketListComponent.displayName = 'PerpsProMarketList';

export const PerpsProMarketList = React.memo(PerpsProMarketListComponent);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    flex: 1,
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
  searchListContent: {
    paddingTop: 16,
  },
  searchEmpty: {
    alignItems: 'center',
    // Sheet y=246: handle 40 + search 46 + results 16 + list 16 + empty 128.
    paddingTop: 128,
  },
  searchEmptyText: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
}));
