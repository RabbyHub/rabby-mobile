import RcPrecisionCaret from '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg';
import { Text } from '@/components/Typography';
import type { PerpsRealtimeStatus } from '@/hooks/perps/subscriptions/usePerpsFastL2';
import type { PerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsServerClockSample } from '../../model/funding';
import { PERPS_PRO_MAIN_COLUMN_HEIGHT } from '../../model/layout';
import type { PerpsProMarket } from '../../model/market';
import {
  calculatePerpsBuyRatio,
  getNextPerpsOrderBookMode,
  getPerpsOrderBookDisplayState,
  getPerpsOrderBookRowCount,
  getVisiblePerpsOrderBookMaxTotal,
  selectVisiblePerpsOrderBookRows,
  type PerpsOrderBookLevel,
  type PerpsOrderBookMode,
  type PerpsTickOption,
  type ProcessedPerpsOrderBook,
} from '../../model/orderBook';
import { formatPerpsProPrice } from '../../utils/format';
import { PerpsProFundingSummary } from '../funding/PerpsProFundingSummary';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import {
  PERPS_PRO_ORDER_BOOK_ROW_HEIGHT,
  PerpsProOrderBookModeIcon,
  PerpsProOrderBookRow,
} from './PerpsProOrderBookPrimitives';
import {
  PerpsProOrderBookBodySkeleton,
  PerpsProOrderBookRatioSkeleton,
} from './PerpsProOrderBookSkeleton';
import { PerpsProPrecisionSheet } from './PerpsProPrecisionSheet';

const ORDER_BOOK_BODY_HEIGHT = 296;

export const PerpsProOrderBook: React.FC<{
  book: ProcessedPerpsOrderBook;
  bookStatus: PerpsRealtimeStatus;
  hasBookSnapshot: boolean;
  latestTrade: PerpsLatestTrade | null;
  market: PerpsProMarket | null;
  onOpenFunding: () => void;
  onSelectTickOption: (option: PerpsTickOption) => void;
  selectedTickOption: PerpsTickOption | null;
  serverClock: PerpsServerClockSample | null;
  tickOptions: PerpsTickOption[];
}> = ({
  book,
  bookStatus,
  hasBookSnapshot,
  latestTrade,
  market,
  onOpenFunding,
  onSelectTickOption,
  selectedTickOption,
  serverClock,
  tickOptions,
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [mode, setMode] = useState<PerpsOrderBookMode>('both');
  const [bodyHeight, setBodyHeight] = useState(ORDER_BOOK_BODY_HEIGHT);
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const rowCount = getPerpsOrderBookRowCount({
    containerHeight: bodyHeight,
    mode,
    rowHeight: PERPS_PRO_ORDER_BOOK_ROW_HEIGHT,
  });
  const visible = useMemo(
    () =>
      selectVisiblePerpsOrderBookRows({
        book,
        mode,
        rowCount,
      }),
    [book, mode, rowCount],
  );
  const maxVisibleTotal = getVisiblePerpsOrderBookMaxTotal(visible);
  const buyRatio = calculatePerpsBuyRatio(book);
  const hasRatio = buyRatio.buy + buyRatio.sell > 0;
  const buyRatioTrackStyle = useMemo<ViewStyle>(
    () => ({ flex: buyRatio.buy }),
    [buyRatio.buy],
  );
  const sellRatioTrackStyle = useMemo<ViewStyle>(
    () => ({ flex: buyRatio.sell }),
    [buyRatio.sell],
  );
  const orderBookPriceDecimals =
    selectedTickOption?.priceDecimals ?? market?.marketData.pxDecimals ?? 2;
  const marketPriceDecimals =
    market?.marketData.pxDecimals ?? orderBookPriceDecimals;
  const modeLabels: Record<PerpsOrderBookMode, string> = {
    both: t('page.perps.pro.orderBook.viewBoth'),
    asks: t('page.perps.pro.orderBook.viewAsks'),
    bids: t('page.perps.pro.orderBook.viewBids'),
  };
  const displayState = getPerpsOrderBookDisplayState({
    hasSnapshot: hasBookSnapshot,
    status: bookStatus,
  });

  const updateBodyHeight = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (Number.isFinite(nextHeight) && Math.abs(nextHeight - bodyHeight) > 1) {
      setBodyHeight(nextHeight);
    }
  };

  const renderRows = (side: 'ask' | 'bid', rows: PerpsOrderBookLevel[]) =>
    Array.from({ length: rowCount }, (_, index) => (
      <PerpsProOrderBookRow
        key={`${side}:${rows[index]?.price ?? index}`}
        level={rows[index]}
        maxTotal={maxVisibleTotal}
        priceDecimals={orderBookPriceDecimals}
        side={side}
      />
    ));

  return (
    <View style={styles.container} testID="perps-pro-order-book-column">
      <PerpsProFundingSummary
        market={market}
        onPress={onOpenFunding}
        serverClock={serverClock}
      />
      <View
        style={styles.columnHeader}
        testID="perps-pro-order-book-column-header">
        <Text style={styles.columnLabel}>
          {t('page.perps.pro.orderBook.price')}
          {'\n'}({market?.quoteAsset ?? '-'})
        </Text>
        <Text style={[styles.columnLabel, styles.columnLabelRight]}>
          {t('page.perps.pro.orderBook.amount')}
          {'\n'}({market?.quoteAsset ?? '-'})
        </Text>
      </View>
      <View
        onLayout={updateBodyHeight}
        style={styles.bookBody}
        testID="perps-pro-order-book">
        {displayState === 'skeleton' ? (
          <PerpsProOrderBookBodySkeleton mode={mode} rowCount={rowCount} />
        ) : displayState === 'content' ? (
          <>
            {mode !== 'bids' ? renderRows('ask', visible.asks) : null}
            {mode === 'both' ? (
              <View
                style={styles.midPrice}
                testID="perps-pro-order-book-mid-price">
                <Text
                  numberOfLines={1}
                  style={
                    latestTrade?.side === 'sell'
                      ? styles.latestSell
                      : styles.latestBuy
                  }>
                  {formatPerpsProPrice(latestTrade?.price, marketPriceDecimals)}
                </Text>
                <PerpsProDottedUnderlineText
                  containerStyle={styles.markPriceUnderline}
                  style={styles.markPrice}>
                  {formatPerpsProPrice(
                    market?.marketData.markPx,
                    marketPriceDecimals,
                  )}
                </PerpsProDottedUnderlineText>
              </View>
            ) : null}
            {mode !== 'asks' ? renderRows('bid', visible.bids) : null}
          </>
        ) : (
          <View pointerEvents="none" style={styles.statusOverlay}>
            <Text style={styles.statusText}>
              {t('page.perps.pro.common.unavailable')}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.ratioRow}>
        {displayState === 'skeleton' ? (
          <PerpsProOrderBookRatioSkeleton />
        ) : (
          <>
            <Text style={styles.buyRatio}>{buyRatio.buy.toFixed(2)}%</Text>
            <View style={styles.ratioTrack}>
              {hasRatio ? (
                <>
                  <View style={[styles.buyRatioTrack, buyRatioTrackStyle]} />
                  <View style={[styles.sellRatioTrack, sellRatioTrackStyle]} />
                </>
              ) : (
                <View style={styles.emptyRatioTrack} />
              )}
            </View>
            <Text style={styles.sellRatio}>{buyRatio.sell.toFixed(2)}%</Text>
          </>
        )}
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={t('page.perps.pro.orderBook.priceAggregation')}
          accessibilityRole="button"
          disabled={!selectedTickOption || tickOptions.length === 0}
          onPress={() => setPrecisionOpen(true)}
          style={styles.precisionTrigger}>
          <Text numberOfLines={1} style={styles.precisionTriggerText}>
            {selectedTickOption
              ? formatPerpsProPrice(
                  selectedTickOption.displayPrice,
                  selectedTickOption.priceDecimals,
                )
              : '-'}
          </Text>
          <View style={styles.precisionCaret}>
            <RcPrecisionCaret
              color={colors2024['neutral-foot']}
              height={6}
              width={8}
            />
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel={modeLabels[mode]}
          accessibilityRole="button"
          hitSlop={5}
          onPress={() => setMode(getNextPerpsOrderBookMode(mode))}>
          <PerpsProOrderBookModeIcon mode={mode} />
        </Pressable>
      </View>
      {precisionOpen ? (
        <PerpsProPrecisionSheet
          onClose={() => setPrecisionOpen(false)}
          onSelect={onSelectTickOption}
          options={tickOptions}
          selected={selectedTickOption}
        />
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    gap: 8,
    height: PERPS_PRO_MAIN_COLUMN_HEIGHT,
    minWidth: 0,
  },
  columnHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 26,
    justifyContent: 'space-between',
  },
  columnLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 12,
  },
  columnLabelRight: {
    textAlign: 'right',
  },
  bookBody: {
    height: ORDER_BOOK_BODY_HEIGHT,
    position: 'relative',
  },
  midPrice: {
    gap: 2,
    height: 48,
    justifyContent: 'center',
    marginVertical: 4,
  },
  latestBuy: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  latestSell: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  markPrice: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  markPriceUnderline: {
    alignSelf: 'center',
  },
  statusOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statusText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 24,
    justifyContent: 'space-between',
  },
  precisionTrigger: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    flexDirection: 'row',
    height: 24,
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    width: 104,
  },
  precisionTriggerText: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  precisionCaret: {
    transform: [{ scaleY: -1 }],
  },
  ratioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 12,
  },
  buyRatio: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  sellRatio: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  ratioTrack: {
    flexDirection: 'row',
    flex: 1,
    gap: 2,
    height: 4,
  },
  buyRatioTrack: {
    backgroundColor: colors2024['green-default'],
    borderRadius: 2,
  },
  sellRatioTrack: {
    backgroundColor: colors2024['red-default'],
    borderRadius: 2,
  },
  emptyRatioTrack: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 2,
    flex: 1,
  },
}));
