import { Text } from '@/components/Typography';
import { FontNames } from '@/core/utils/fonts';
import type { PerpsRealtimeStatus } from '@/hooks/perps/subscriptions/usePerpsFastL2';
import type { PerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { PerpsServerClockSample } from '../../model/funding';
import { PERPS_PRO_MAIN_COLUMN_HEIGHT } from '../../model/layout';
import type { PerpsProMarket } from '../../model/market';
import type { PerpsProOrderBookPriceIntent } from '../../model/orderBookPriceIntent';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import {
  calculatePerpsBuyRatio,
  getNextPerpsOrderBookMode,
  getPerpsOrderBookDisplayState,
  getPerpsOrderBookLayout,
  getVisiblePerpsOrderBookMaxTotal,
  selectVisiblePerpsOrderBookRows,
  type PerpsOrderBookDisplayRow,
  type PerpsOrderBookMode,
  type PerpsTickOption,
  type ProcessedPerpsOrderBook,
} from '../../model/orderBook';
import { formatPerpsProPrice } from '../../utils/format';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import { PerpsProFundingSummary } from '../funding/PerpsProFundingSummary';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import {
  PerpsProOrderBookDepth,
  PerpsProOrderBookModeIcon,
  PerpsProOrderBookRow,
} from './PerpsProOrderBookPrimitives';
import {
  PerpsProOrderBookBodySkeleton,
  PerpsProOrderBookRatioSkeleton,
} from './PerpsProOrderBookSkeleton';
import { PerpsProPrecisionSheet } from './PerpsProPrecisionSheet';
import { usePerpsProOrderBookPercentAnimation } from './usePerpsProOrderBookPercentAnimation';

export const getPerpsProOrderBookRowKey = (
  side: 'ask' | 'bid',
  index: number,
) => `${side}:${index}`;

export const getPerpsProOrderBookDepthKey = (
  side: 'ask' | 'bid',
  level: Readonly<{ price: string }>,
) => `${side}:${level.price}`;

export type PerpsProOrderBookPriceSelectionSource = Readonly<{
  feedIdentity: string;
  marketKey: string;
  type: 'book' | 'latestTrade';
}>;

type PendingPriceSelection = Readonly<{
  intent: PerpsProOrderBookPriceIntent;
  price: string | null;
  source: PerpsProOrderBookPriceSelectionSource;
}>;

export const PerpsProOrderBook: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  bookIdentity: string;
  book: ProcessedPerpsOrderBook;
  bookStatus: PerpsRealtimeStatus;
  hasBookSnapshot: boolean;
  height?: number;
  latestTrade: PerpsLatestTrade | null;
  latestTradeIdentity: string;
  market: PerpsProMarket | null;
  onOpenFunding: () => void;
  onPrecisionIntentStart?: (option: PerpsTickOption) => void;
  onSelectBookPrice?: (
    price: string | null,
    intent: PerpsProOrderBookPriceIntent,
    source: PerpsProOrderBookPriceSelectionSource,
  ) => void;
  onSelectLatestTradePrice?: (
    price: string | null,
    intent: PerpsProOrderBookPriceIntent,
    source: PerpsProOrderBookPriceSelectionSource,
  ) => void;
  onSelectPriceIntentStart?: () => PerpsProOrderBookPriceIntent;
  onSelectTickOption: (option: PerpsTickOption) => void;
  selectedTickOption: PerpsTickOption | null;
  serverClock: PerpsServerClockSample | null;
  tickOptions: PerpsTickOption[];
}> = ({
  amountUnit = 'quote',
  bookIdentity,
  book,
  bookStatus,
  hasBookSnapshot,
  height = PERPS_PRO_MAIN_COLUMN_HEIGHT,
  latestTrade,
  latestTradeIdentity,
  market,
  onOpenFunding,
  onPrecisionIntentStart,
  onSelectBookPrice,
  onSelectLatestTradePrice,
  onSelectPriceIntentStart,
  onSelectTickOption,
  selectedTickOption,
  serverClock,
  tickOptions,
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const openFieldExplanation = usePerpsProFieldExplanation();
  const [mode, setMode] = useState<PerpsOrderBookMode>('both');
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const layout = getPerpsOrderBookLayout({
    containerHeight: height,
    mode,
  });
  const rowCount = layout.rowCount;
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
  const orderBookPriceDecimals =
    selectedTickOption?.priceDecimals ?? market?.marketData.pxDecimals ?? 2;
  const marketPriceDecimals =
    market?.marketData.pxDecimals ?? orderBookPriceDecimals;
  const amountDecimals =
    amountUnit === 'base' ? market?.marketData.szDecimals ?? 2 : 2;
  const modeLabels: Record<PerpsOrderBookMode, string> = {
    both: t('page.perps.pro.orderBook.viewBoth'),
    asks: t('page.perps.pro.orderBook.viewAsks'),
    bids: t('page.perps.pro.orderBook.viewBids'),
  };
  const displayState = getPerpsOrderBookDisplayState({
    hasSnapshot: hasBookSnapshot,
    status: bookStatus,
  });
  const animationIdentity = `${bookIdentity}|${mode}|${rowCount}|${displayState}`;
  const animatedBuyRatio = usePerpsProOrderBookPercentAnimation({
    animationIdentity,
    hasValue: hasRatio,
    targetPercent: buyRatio.buy,
    valueIdentity: 'buy-ratio',
  });
  const buyRatioTrackStyle = useAnimatedStyle(() => ({
    flexGrow: animatedBuyRatio.value,
  }));
  const sellRatioTrackStyle = useAnimatedStyle(() => ({
    flexGrow: 100 - animatedBuyRatio.value,
  }));
  const pendingPriceSelectionRef = useRef<PendingPriceSelection | null>(null);
  const getPriceSelectionSource = useCallback(
    (
      type: PerpsProOrderBookPriceSelectionSource['type'],
    ): PerpsProOrderBookPriceSelectionSource => ({
      feedIdentity: type === 'book' ? bookIdentity : latestTradeIdentity,
      marketKey: market?.marketKey ?? '',
      type,
    }),
    [bookIdentity, latestTradeIdentity, market?.marketKey],
  );
  const startPriceSelection = useCallback(
    (
      type: PerpsProOrderBookPriceSelectionSource['type'],
      price: string | null,
    ) => {
      pendingPriceSelectionRef.current = {
        intent: onSelectPriceIntentStart?.() ?? { type: 'tradePrice' },
        price,
        source: getPriceSelectionSource(type),
      };
    },
    [getPriceSelectionSource, onSelectPriceIntentStart],
  );
  const finishPriceSelection = useCallback(
    (
      type: PerpsProOrderBookPriceSelectionSource['type'],
      currentPrice: string | null,
    ) => {
      const pending = pendingPriceSelectionRef.current;
      pendingPriceSelectionRef.current = null;
      const selection =
        pending?.source.type === type
          ? pending
          : {
              intent: onSelectPriceIntentStart?.() ?? {
                type: 'tradePrice' as const,
              },
              price: currentPrice,
              source: getPriceSelectionSource(type),
            };
      const selectPrice =
        type === 'book' ? onSelectBookPrice : onSelectLatestTradePrice;
      selectPrice?.(selection.price, selection.intent, selection.source);
    },
    [
      getPriceSelectionSource,
      onSelectBookPrice,
      onSelectLatestTradePrice,
      onSelectPriceIntentStart,
    ],
  );

  const renderRows = (
    side: 'ask' | 'bid',
    rows: PerpsOrderBookDisplayRow[],
  ) => {
    const displayRows = Array.from(
      { length: rowCount },
      (_, index) => rows[index] ?? null,
    );
    return (
      <View style={styles.bookSide}>
        <View pointerEvents="none" style={styles.bookDepthLayer}>
          {displayRows.map((level, index) =>
            level ? (
              <PerpsProOrderBookDepth
                animationIdentity={animationIdentity}
                key={getPerpsProOrderBookDepthKey(side, level)}
                level={level}
                maxTotal={maxVisibleTotal}
                rowIndex={index}
                side={side}
              />
            ) : null,
          )}
        </View>
        {displayRows.map((level, index) => (
          <PerpsProOrderBookRow
            amountDecimals={amountDecimals}
            amountUnit={amountUnit}
            key={getPerpsProOrderBookRowKey(side, index)}
            level={level ?? undefined}
            onSelectPrice={
              onSelectBookPrice
                ? () => finishPriceSelection('book', level?.price ?? null)
                : undefined
            }
            onSelectPriceIntentStart={
              onSelectBookPrice
                ? () => startPriceSelection('book', level?.price ?? null)
                : undefined
            }
            priceDecimals={orderBookPriceDecimals}
            side={side}
          />
        ))}
      </View>
    );
  };

  const latestTradePressable = (
    <Pressable
      accessibilityRole={
        latestTrade && onSelectLatestTradePrice ? 'button' : undefined
      }
      disabled={!latestTrade || !onSelectLatestTradePrice}
      onPressIn={
        latestTrade && onSelectLatestTradePrice
          ? () => startPriceSelection('latestTrade', latestTrade.price)
          : undefined
      }
      onPress={
        latestTrade && onSelectLatestTradePrice
          ? () => finishPriceSelection('latestTrade', latestTrade.price)
          : undefined
      }
      testID="perps-pro-order-book-latest-price">
      <Text
        numberOfLines={1}
        style={
          latestTrade?.side === 'sell' ? styles.latestSell : styles.latestBuy
        }>
        {formatPerpsProPrice(latestTrade?.price, marketPriceDecimals)}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[styles.container, { height }]}
      testID="perps-pro-order-book-column">
      <PerpsProFundingSummary
        market={market}
        onPress={onOpenFunding}
        serverClock={serverClock}
      />
      <View style={styles.bookContent}>
        <View
          style={styles.columnHeader}
          testID="perps-pro-order-book-column-header">
          <Text style={styles.columnLabel}>
            {t('page.perps.pro.orderBook.price')}
            {'\n'}({market?.quoteAsset ?? '-'})
          </Text>
          <Text style={[styles.columnLabel, styles.columnLabelRight]}>
            {t('page.perps.pro.orderBook.amount')}
            {'\n'}(
            {amountUnit === 'base'
              ? market?.displayBase ?? '-'
              : market?.quoteAsset ?? '-'}
            )
          </Text>
        </View>
        <View
          style={[styles.bookBody, { height: layout.bodyHeight }]}
          testID="perps-pro-order-book">
          {displayState === 'skeleton' ? (
            <PerpsProOrderBookBodySkeleton mode={mode} rowCount={rowCount} />
          ) : displayState === 'content' ? (
            <View style={styles.bookSections}>
              {mode !== 'bids' ? renderRows('ask', visible.asks) : null}
              {mode !== 'asks' ? (
                <View
                  style={[styles.midPrice, { height: layout.middleHeight }]}
                  testID="perps-pro-order-book-mid-price">
                  {latestTradePressable}
                  <PerpsProDottedUnderlineText
                    accessibilityLabel={t(
                      'page.perps.pro.fieldExplanations.markPrice.title',
                    )}
                    containerStyle={styles.markPriceUnderline}
                    onPress={() => openFieldExplanation('markPrice')}
                    style={styles.markPrice}>
                    {formatPerpsProPrice(
                      market?.marketData.markPx,
                      marketPriceDecimals,
                    )}
                  </PerpsProDottedUnderlineText>
                </View>
              ) : null}
              {mode !== 'asks' ? renderRows('bid', visible.bids) : null}
              {mode === 'asks' ? (
                <View
                  style={[styles.midPrice, { height: layout.middleHeight }]}
                  testID="perps-pro-order-book-mid-price">
                  {latestTradePressable}
                  <PerpsProDottedUnderlineText
                    accessibilityLabel={t(
                      'page.perps.pro.fieldExplanations.markPrice.title',
                    )}
                    containerStyle={styles.markPriceUnderline}
                    onPress={() => openFieldExplanation('markPrice')}
                    style={styles.markPrice}>
                    {formatPerpsProPrice(
                      market?.marketData.markPx,
                      marketPriceDecimals,
                    )}
                  </PerpsProDottedUnderlineText>
                </View>
              ) : null}
            </View>
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
                    <Animated.View
                      style={[styles.buyRatioTrack, buyRatioTrackStyle]}
                      testID="perps-pro-order-book-buy-ratio-track"
                    />
                    <Animated.View
                      style={[styles.sellRatioTrack, sellRatioTrackStyle]}
                      testID="perps-pro-order-book-sell-ratio-track"
                    />
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
            <PerpsProSelectCaret color={colors2024['neutral-foot']} />
          </Pressable>
          <Pressable
            accessibilityLabel={modeLabels[mode]}
            accessibilityRole="button"
            hitSlop={5}
            onPress={() => setMode(getNextPerpsOrderBookMode(mode))}>
            <PerpsProOrderBookModeIcon mode={mode} />
          </Pressable>
        </View>
      </View>
      {precisionOpen ? (
        <PerpsProPrecisionSheet
          onClose={() => setPrecisionOpen(false)}
          onIntentStart={onPrecisionIntentStart}
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
    minWidth: 0,
  },
  bookContent: {
    flex: 1,
    gap: 4,
  },
  columnHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 26,
    justifyContent: 'space-between',
  },
  columnLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: FontNames.sf_pro,
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 12,
  },
  columnLabelRight: {
    textAlign: 'right',
  },
  bookBody: {
    position: 'relative',
  },
  bookSections: {
    gap: 4,
  },
  bookSide: {
    overflow: 'hidden',
    position: 'relative',
  },
  bookDepthLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  midPrice: {
    gap: 2,
    justifyContent: 'center',
  },
  latestBuy: {
    color: colors2024['green-default'],
    fontFamily: FontNames.sf_pro,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  latestSell: {
    color: colors2024['red-default'],
    fontFamily: FontNames.sf_pro,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  markPrice: {
    color: colors2024['neutral-foot'],
    fontFamily: FontNames.sf_pro,
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
    fontFamily: FontNames.sf_pro,
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
    fontFamily: FontNames.sf_pro,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  ratioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 12,
  },
  buyRatio: {
    color: colors2024['green-default'],
    fontFamily: FontNames.sf_pro,
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  sellRatio: {
    color: colors2024['red-default'],
    fontFamily: FontNames.sf_pro,
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
    flexBasis: 0,
  },
  sellRatioTrack: {
    backgroundColor: colors2024['red-default'],
    borderRadius: 2,
    flexBasis: 0,
  },
  emptyRatioTrack: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 2,
    flex: 1,
  },
}));
