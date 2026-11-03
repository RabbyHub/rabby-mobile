import RcIconClose from '@/assets2024/icons/perps/PerpsProKline/close.svg';
import RcIconReset from '@/assets2024/icons/perps/PerpsSimpleChart/reset.svg';
import TradingViewCandleChart, {
  type CandleDataApplied,
  type OlderCandlesRequest,
  type TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import type {
  CandleData,
  CandleStick,
  PerpsProOverlays,
} from '@/components2024/TradingViewCandleChart/type';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import type {
  PerpsCandleFeedSnapshot,
  PerpsCandleHistoryLoadResult,
} from '@/hooks/perps/candles/usePerpsCandleFeed';
import { useTheme2024 } from '@/hooks/theme';
import { SIMPLE_CHART_COLORS } from '@/screens/PerpsMarketDetail/components/chart/visual';
import { createGetStyles2024 } from '@/utils/styles';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildPerpsProKlineOverlayLines } from '../../model/klineOverlay';
import type { PerpsProMarket } from '../../model/market';
import type { PerpsPositionViewModel } from '../../model/position';
import { usePerpsProKline } from '../../scene/usePerpsProKline';
import {
  PERPS_PRO_KLINE_CHART_HEIGHT,
  PerpsProKlineSkeleton,
} from './PerpsProKlineSkeleton';
import {
  PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
  PerpsProKlineToolbar,
} from './PerpsProKlineToolbar';

// Figma 86356:56301: handle row (10 + 4 + 20) above the 24px interval row.
const PERPS_PRO_KLINE_HANDLE_AREA_HEIGHT = 34;
export const PERPS_PRO_KLINE_HEADER_HEIGHT =
  PERPS_PRO_KLINE_HANDLE_AREA_HEIGHT + PERPS_PRO_KLINE_TOOLBAR_HEIGHT;
const PERPS_PRO_KLINE_MIN_BOTTOM_PADDING = 16;
const PERPS_PRO_KLINE_CHART_LEFT_INSET = 12;
const PERPS_PRO_KLINE_RESET_SIZE = 20;
// Reset sits in the time-axis row, right of the last tick (Figma x355 y264).
const PERPS_PRO_KLINE_RESET_RIGHT = 18;
const PERPS_PRO_KLINE_RESET_TOP = 206;

export const getPerpsProKlinePanelHeight = (bottomInset: number) =>
  PERPS_PRO_KLINE_HEADER_HEIGHT +
  PERPS_PRO_KLINE_CHART_HEIGHT +
  Math.max(PERPS_PRO_KLINE_MIN_BOTTOM_PADDING, bottomInset);
const PERPS_PRO_KLINE_INITIAL_VISIBLE_BARS = 40;
const PERPS_PRO_KLINE_MA_PERIODS = [7, 25, 99] as const;

const toChartCandle = (
  candle: PerpsCandleFeedSnapshot['candles'][number],
): CandleStick => ({
  close: candle.close,
  high: candle.high,
  low: candle.low,
  open: candle.open,
  quoteTurnover: candle.quoteTurnover,
  time: Math.floor(candle.time / 1000),
  trades: candle.trades,
  volume: candle.volume,
});

const getPriceDecimals = (decimals: number) => {
  return Number.isInteger(decimals) && decimals >= 0
    ? Math.min(decimals, 12)
    : 2;
};

const PerpsProKlineChart: React.FC<{
  chartRef: React.RefObject<TradingViewChartRef | null>;
  feed: PerpsCandleFeedSnapshot;
  interval: PerpsCandleDataInterval;
  market: PerpsProMarket;
  onLoadOlder: () => Promise<PerpsCandleHistoryLoadResult>;
  onViewportChange: (resetVisible: boolean) => void;
  overlays: PerpsProOverlays;
  visible: boolean;
}> = ({
  chartRef,
  feed,
  interval,
  market,
  onLoadOlder,
  onViewportChange,
  overlays,
  visible,
}) => {
  const { colors2024 } = useTheme2024();
  const lastSentRef = useRef<{
    identity: string;
    readyVersion: number;
    revision: number;
  } | null>(null);
  const revisionRef = useRef(0);
  const lastClearedIdentityRef = useRef<string | null>(null);
  const [readyVersion, setReadyVersion] = useState(0);
  const [displayedSnapshot, setDisplayedSnapshot] = useState<{
    identity: string;
    readyVersion: number;
    revision: number;
  } | null>(null);
  const [chartFailed, setChartFailed] = useState(false);
  const candles = useMemo(
    () => feed.candles.map(toChartCandle),
    [feed.candles],
  );
  const priceDecimals = getPriceDecimals(market.marketData.pxDecimals);
  const chartData = useMemo<CandleData>(
    () => ({
      candles,
      coin: market.canonicalCoin,
      fitContent: false,
      interval,
      noTime: false,
      proConfig: {
        baseAsset: market.displayBase,
        initialVisibleBars: PERPS_PRO_KLINE_INITIAL_VISIBLE_BARS,
        interval,
        maPeriods: PERPS_PRO_KLINE_MA_PERIODS,
        priceDecimals,
        quoteAsset: market.quoteAsset,
        variant: 'perps-pro',
      },
      showVolume: false,
    }),
    [
      candles,
      interval,
      market.canonicalCoin,
      market.displayBase,
      market.quoteAsset,
      priceDecimals,
    ],
  );
  const handleChartReady = useCallback(() => {
    setChartFailed(false);
    setReadyVersion(version => version + 1);
  }, []);
  const handleChartError = useCallback(() => {
    setChartFailed(true);
  }, []);
  const handleDataApplied = useCallback((applied: CandleDataApplied) => {
    const latestSent = lastSentRef.current;
    if (
      !latestSent ||
      latestSent.identity !== applied.identity ||
      latestSent.revision !== applied.revision
    ) {
      return;
    }
    setDisplayedSnapshot({
      identity: applied.identity,
      readyVersion: latestSent.readyVersion,
      revision: applied.revision,
    });
  }, []);

  useEffect(() => {
    if (
      readyVersion === 0 ||
      chartFailed ||
      feed.status !== 'ready' ||
      candles.length === 0
    ) {
      return;
    }
    const previous = lastSentRef.current;
    const canUpdateRealtime =
      feed.updateType === 'realtime' &&
      previous?.identity === feed.identity &&
      previous.readyVersion === readyVersion;
    const latestCandle = candles[candles.length - 1];
    if (canUpdateRealtime && latestCandle) {
      chartRef.current?.updateCandleData(latestCandle);
    } else {
      const chart = chartRef.current;
      if (!chart) {
        return;
      }
      const revision = revisionRef.current + 1;
      revisionRef.current = revision;
      lastSentRef.current = {
        identity: feed.identity,
        readyVersion,
        revision,
      };
      chart.setData({
        ...chartData,
        identity: feed.identity,
        ...(feed.updateType === 'history'
          ? { preserveVisibleRange: true }
          : {}),
        revision,
      });
      return;
    }
    lastSentRef.current = {
      identity: feed.identity,
      readyVersion,
      revision: previous?.revision ?? revisionRef.current,
    };
  }, [
    candles,
    chartData,
    chartFailed,
    chartRef,
    feed.identity,
    feed.status,
    feed.updateType,
    readyVersion,
  ]);

  const handleRequestOlderCandles = useCallback(
    async (request: OlderCandlesRequest) => {
      if (!visible || request.identity !== feed.identity) {
        chartRef.current?.completeOlderCandlesRequest({
          ...request,
          outcome: 'retry',
        });
        return;
      }
      const result = await onLoadOlder();
      if (result === 'loaded') {
        return;
      }
      chartRef.current?.completeOlderCandlesRequest({
        ...request,
        outcome: result === 'exhausted' ? 'exhausted' : 'retry',
      });
    },
    [chartRef, feed.identity, onLoadOlder, visible],
  );

  const hasDisplayedSnapshot =
    displayedSnapshot != null &&
    displayedSnapshot.readyVersion === readyVersion;
  const isIntervalSwitchLoading =
    feed.status === 'loading' &&
    hasDisplayedSnapshot &&
    displayedSnapshot.identity !== feed.identity;
  const isCurrentFeedDisplayed =
    feed.status === 'ready' &&
    candles.length > 0 &&
    hasDisplayedSnapshot &&
    displayedSnapshot.identity === feed.identity;
  const isReplacementPending =
    feed.status === 'ready' &&
    candles.length > 0 &&
    hasDisplayedSnapshot &&
    displayedSnapshot.identity !== feed.identity;

  useEffect(() => {
    if (
      !isIntervalSwitchLoading ||
      lastClearedIdentityRef.current === feed.identity
    ) {
      return;
    }
    chartRef.current?.clearCrosshair();
    lastClearedIdentityRef.current = feed.identity;
  }, [chartRef, feed.identity, isIntervalSwitchLoading]);

  useEffect(() => {
    if (visible) {
      return;
    }
    chartRef.current?.clearCrosshair();
  }, [chartRef, visible]);

  // A reloaded WebView starts without overlays; resend on every ready.
  useEffect(() => {
    if (readyVersion === 0 || chartFailed) {
      return;
    }
    chartRef.current?.setPerpsProOverlays(overlays);
  }, [chartFailed, chartRef, overlays, readyVersion]);

  const showSkeleton =
    chartFailed ||
    readyVersion === 0 ||
    (!isIntervalSwitchLoading &&
      !isReplacementPending &&
      !isCurrentFeedDisplayed);

  return (
    <View
      style={[
        styles.chartContainer,
        { backgroundColor: colors2024['neutral-bg-1'] },
      ]}>
      <TradingViewCandleChart
        backGroundColor={colors2024['neutral-bg-1']}
        ref={chartRef}
        height={PERPS_PRO_KLINE_CHART_HEIGHT}
        onChartError={handleChartError}
        onChartReady={handleChartReady}
        onDataApplied={handleDataApplied}
        onPerpsProViewportChange={onViewportChange}
        onRequestOlderCandles={handleRequestOlderCandles}
        variant="perps-pro"
      />
      {showSkeleton ? <PerpsProKlineSkeleton overlay /> : null}
    </View>
  );
};

const PerpsProKlineHeader: React.FC<{
  disabled: boolean;
  interval: PerpsCandleDataInterval;
  onClose: () => void;
  onSelect: (interval: PerpsCandleDataInterval) => void;
}> = React.memo(({ disabled, interval, onClose, onSelect }) => {
  const { colors2024, styles: themedStyles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={themedStyles.header} testID="perps-pro-kline-header">
      <View style={themedStyles.indicator} />
      <Pressable
        accessibilityLabel={t('global.closeButton')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onClose}
        style={themedStyles.closeButton}
        testID="perps-pro-kline-close">
        <RcIconClose
          color={colors2024['neutral-secondary']}
          height={20}
          width={20}
        />
      </Pressable>
      <PerpsProKlineToolbar
        disabled={disabled}
        interval={interval}
        onSelect={onSelect}
      />
    </View>
  );
});

PerpsProKlineHeader.displayName = 'PerpsProKlineHeader';

/**
 * Docked, non-modal K-line panel. The page above stays scrollable and
 * interactive; only the header (handle + intervals) drags the panel closed.
 */
export const PerpsProKlineSheet: React.FC<{
  enabled: boolean;
  market: PerpsProMarket;
  onClose: () => void;
  position: PerpsPositionViewModel | null;
  preloadEnabled?: boolean;
  visible?: boolean;
}> = ({
  enabled,
  market,
  onClose,
  position,
  preloadEnabled = enabled,
  visible = true,
}) => {
  const chartRef = useRef<TradingViewChartRef>(null);
  const [viewportState, setViewportState] = useState({
    marketKey: market.marketKey,
    resetVisible: false,
  });
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { colors2024, styles: themedStyles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const kline = usePerpsProKline({
    coin: market.canonicalCoin,
    enabled,
    preloadEnabled,
  });
  const panelHeight = getPerpsProKlinePanelHeight(bottomInset);
  const snapPoints = useMemo(() => [panelHeight], [panelHeight]);
  // Position objects are rebuilt on every account tick (PnL); only a change
  // of the drawn guides should reach the WebView.
  const overlayLinesKey = JSON.stringify(
    buildPerpsProKlineOverlayLines(position, {
      entry: t('page.perpsDetail.simpleChart.averageEntry'),
      liquidation: t('page.perpsDetail.simpleChart.liquidation'),
      stopLoss: t('page.perpsDetail.simpleChart.stopLoss'),
      takeProfit: t('page.perpsDetail.simpleChart.takeProfit'),
    }),
  );
  const overlays = useMemo<PerpsProOverlays>(
    () => ({
      colors: {
        accent: SIMPLE_CHART_COLORS.accent,
        background: colors2024['neutral-bg-1'],
        contrast: colors2024['neutral-InvertHighlight'],
        down: SIMPLE_CHART_COLORS.down,
        entry: colors2024['neutral-foot'],
        entryBackground: colors2024['neutral-info'],
        entryText: colors2024['neutral-body'],
        liquidation: colors2024['orange-default'],
        up: SIMPLE_CHART_COLORS.up,
      },
      lines: JSON.parse(overlayLinesKey),
    }),
    [colors2024, overlayLinesKey],
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1 && visible) {
        onClose();
      }
    },
    [onClose, visible],
  );
  const handleResetViewport = useCallback(() => {
    chartRef.current?.resetPerpsProViewport();
  }, []);
  const handleViewportChange = useCallback(
    (resetVisible: boolean) => {
      setViewportState(previous =>
        previous.marketKey === market.marketKey &&
        previous.resetVisible === resetVisible
          ? previous
          : { marketKey: market.marketKey, resetVisible },
      );
    },
    [market.marketKey],
  );
  const resetVisible =
    viewportState.marketKey === market.marketKey && viewportState.resetVisible;
  const renderHeader = useCallback(
    () => (
      <PerpsProKlineHeader
        disabled={!kline.hydrated}
        interval={kline.interval}
        onClose={onClose}
        onSelect={kline.selectInterval}
      />
    ),
    [kline.hydrated, kline.interval, kline.selectInterval, onClose],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose, visible]);

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={styles.retainedHost}
      testID="perps-pro-kline-retained-host">
      <BottomSheet
        activeOffsetY={[-8, 8]}
        animateOnMount={false}
        backgroundStyle={themedStyles.background}
        enableContentPanningGesture={false}
        enableDynamicSizing={false}
        enableHandlePanningGesture
        enablePanDownToClose
        failOffsetX={[-8, 8]}
        handleComponent={renderHeader}
        index={visible ? 0 : -1}
        keyboardBehavior="extend"
        onChange={handleSheetChange}
        snapPoints={snapPoints}>
        <BottomSheetView style={themedStyles.content}>
          <PerpsProKlineChart
            key={market.marketKey}
            chartRef={chartRef}
            feed={kline.feed}
            interval={kline.interval}
            market={market}
            onLoadOlder={kline.loadOlder}
            onViewportChange={handleViewportChange}
            overlays={overlays}
            visible={visible}
          />
          {resetVisible ? (
            <Pressable
              accessibilityLabel={t('page.perpsDetail.simpleChart.resetChart')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleResetViewport}
              style={styles.resetButton}
              testID="perps-pro-kline-reset">
              <RcIconReset
                height={PERPS_PRO_KLINE_RESET_SIZE}
                width={PERPS_PRO_KLINE_RESET_SIZE}
              />
            </Pressable>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

const styles = {
  chartContainer: {
    height: PERPS_PRO_KLINE_CHART_HEIGHT,
    marginLeft: PERPS_PRO_KLINE_CHART_LEFT_INSET,
  },
  resetButton: {
    height: PERPS_PRO_KLINE_RESET_SIZE,
    position: 'absolute' as const,
    right: PERPS_PRO_KLINE_RESET_RIGHT,
    top: PERPS_PRO_KLINE_RESET_TOP,
    width: PERPS_PRO_KLINE_RESET_SIZE,
  },
  retainedHost: {
    bottom: 0,
    left: 0,
    position: 'absolute' as const,
    right: 0,
    top: 0,
    zIndex: 100,
  },
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  // Figma 86356:56301: 24px top corners and a soft upward shadow; the
  // background owns the shadow so nothing clips it.
  background: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0px -4px 16px 0px rgba(0, 0, 0, 0.1)',
  },
  header: {
    height: PERPS_PRO_KLINE_HEADER_HEIGHT,
    paddingTop: PERPS_PRO_KLINE_HANDLE_AREA_HEIGHT,
  },
  indicator: {
    alignSelf: 'center',
    backgroundColor: colors2024['neutral-sheet-handle'],
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    top: 10,
    width: 50,
  },
  closeButton: {
    height: 20,
    position: 'absolute',
    right: 16,
    top: 10,
    width: 20,
    zIndex: 1,
  },
  content: {
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
  },
}));
