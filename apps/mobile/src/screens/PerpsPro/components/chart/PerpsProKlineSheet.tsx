import TradingViewCandleChart, {
  type CandleDataApplied,
  type OlderCandlesRequest,
  type TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import type {
  CandleData,
  CandleStick,
} from '@/components2024/TradingViewCandleChart/type';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import type { PerpsCandleInterval } from '@/constant/perps';
import type {
  PerpsCandleFeedSnapshot,
  PerpsCandleHistoryLoadResult,
} from '@/hooks/perps/candles/usePerpsCandleFeed';
import { useTheme2024 } from '@/hooks/theme';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { createGetStyles2024 } from '@/utils/styles';
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, View } from 'react-native';

import type { PerpsProMarketDescriptor } from '../../model/market';
import { usePerpsProKline } from '../../scene/usePerpsProKline';
import { selectPerpsProMarketData } from '../../scene/usePerpsProLiveMarket';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import {
  PERPS_PRO_KLINE_CHART_HEIGHT,
  PerpsProKlineSkeleton,
} from './PerpsProKlineSkeleton';
import {
  PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
  PerpsProKlineToolbar,
} from './PerpsProKlineToolbar';

export const PERPS_PRO_KLINE_HANDLE_HEIGHT = 40;
export const PERPS_PRO_KLINE_FOOTER_HEIGHT = 40;
export const PERPS_PRO_KLINE_CONTENT_HEIGHT =
  PERPS_PRO_KLINE_TOOLBAR_HEIGHT +
  PERPS_PRO_KLINE_CHART_HEIGHT +
  PERPS_PRO_KLINE_FOOTER_HEIGHT;
export const PERPS_PRO_KLINE_SHEET_HEIGHT =
  PERPS_PRO_KLINE_HANDLE_HEIGHT + PERPS_PRO_KLINE_CONTENT_HEIGHT;
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

type KlineChartMarket = Pick<
  PerpsProMarketDescriptor,
  'canonicalCoin' | 'displayBase' | 'quoteAsset'
> & { priceDecimals: number };

const PerpsProKlineChart: React.FC<{
  chartRef: React.RefObject<TradingViewChartRef | null>;
  feed: PerpsCandleFeedSnapshot;
  interval: PerpsCandleInterval;
  liveFeedEnabled: boolean;
  market: KlineChartMarket;
  onLoadOlder: () => Promise<PerpsCandleHistoryLoadResult>;
  onPriceScaleAutoScaleChange: (autoScale: boolean) => void;
  publicationEnabled: boolean;
  visible: boolean;
}> = React.memo(function PerpsProKlineChart({
  chartRef,
  feed,
  interval,
  liveFeedEnabled,
  market,
  onLoadOlder,
  onPriceScaleAutoScaleChange,
  publicationEnabled,
  visible,
}) {
  const { colors2024 } = useTheme2024();
  const lastSentRef = useRef<{
    identity: string;
    publicationEpoch: number;
    readyVersion: number;
    revision: number;
  } | null>(null);
  const revisionRef = useRef(0);
  const lastClearedIdentityRef = useRef<string | null>(null);
  const pausedPublicationRef = useRef<{
    epoch: number;
    identity: string;
  } | null>(null);
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
  const priceDecimals = market.priceDecimals;
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
    const publicationEpoch = feed.publicationEpoch ?? 0;
    if (!publicationEnabled) {
      pausedPublicationRef.current = {
        epoch: publicationEpoch,
        identity: feed.identity,
      };
      return;
    }
    const paused = pausedPublicationRef.current;
    if (
      liveFeedEnabled &&
      paused?.identity === feed.identity &&
      paused.epoch === publicationEpoch
    ) {
      // Visibility reaches the host before the feed's resume effect. Do not
      // resend the retained snapshot in that intermediate render.
      return;
    }
    pausedPublicationRef.current = null;
    if (
      readyVersion === 0 ||
      chartFailed ||
      feed.status !== 'ready' ||
      candles.length === 0
    ) {
      return;
    }
    const previous = lastSentRef.current;
    const resumedSameChart =
      previous?.identity === feed.identity &&
      previous.readyVersion === readyVersion &&
      previous.publicationEpoch !== publicationEpoch;
    const canUpdateRealtime =
      feed.updateType === 'realtime' &&
      previous?.identity === feed.identity &&
      previous.readyVersion === readyVersion &&
      !resumedSameChart;
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
        publicationEpoch,
        readyVersion,
        revision,
      };
      chart.setData({
        ...chartData,
        identity: feed.identity,
        ...(feed.updateType === 'history' || resumedSameChart
          ? { preserveVisibleRange: true }
          : {}),
        revision,
      });
      return;
    }
    lastSentRef.current = {
      identity: feed.identity,
      publicationEpoch,
      readyVersion,
      revision: previous?.revision ?? revisionRef.current,
    };
  }, [
    candles,
    chartData,
    chartFailed,
    chartRef,
    feed.identity,
    feed.publicationEpoch,
    feed.status,
    feed.updateType,
    liveFeedEnabled,
    publicationEnabled,
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
        onPriceScaleAutoScaleChange={onPriceScaleAutoScaleChange}
        onRequestOlderCandles={handleRequestOlderCandles}
        variant="perps-pro"
      />
      {showSkeleton ? <PerpsProKlineSkeleton overlay /> : null}
    </View>
  );
});

type PerpsProKlineSheetProps = {
  enabled: boolean;
  market: PerpsProMarketDescriptor;
  onClose: () => void;
  preloadEnabled?: boolean;
  publicationEnabled?: boolean;
  visible?: boolean;
};

export const PerpsProKlineSheet = React.memo(function PerpsProKlineSheet({
  enabled,
  market,
  onClose,
  preloadEnabled = enabled,
  publicationEnabled = true,
  visible = true,
}: PerpsProKlineSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const chartRef = useRef<TradingViewChartRef>(null);
  const [priceScaleState, setPriceScaleState] = useState({
    autoScale: true,
    marketKey: market.marketKey,
  });
  const { colors2024, styles: themedStyles } = useTheme2024({
    getStyle,
  });
  const kline = usePerpsProKline({
    coin: market.canonicalCoin,
    enabled,
    preloadEnabled,
    publicationEnabled,
  });
  const priceDecimals = perpsStore(state =>
    getPriceDecimals(
      selectPerpsProMarketData(state, market.canonicalCoin)?.pxDecimals ?? 2,
    ),
  );
  // Chart precision follows metadata, not every market price tick.
  const chartMarket = useMemo<KlineChartMarket>(
    () => ({
      canonicalCoin: market.canonicalCoin,
      displayBase: market.displayBase,
      priceDecimals,
      quoteAsset: market.quoteAsset,
    }),
    [
      market.canonicalCoin,
      market.displayBase,
      priceDecimals,
      market.quoteAsset,
    ],
  );
  const bottomSheetProps = useMemo(
    () =>
      makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      }),
    [colors2024],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1 && visible) {
        onClose();
      }
    },
    [onClose, visible],
  );
  const handleResetPriceScale = useCallback(() => {
    chartRef.current?.resetPriceScale();
  }, []);
  const handlePriceScaleAutoScaleChange = useCallback(
    (autoScale: boolean) => {
      setPriceScaleState(previous => {
        if (
          previous.marketKey === market.marketKey &&
          previous.autoScale === autoScale
        ) {
          return previous;
        }
        return { autoScale, marketKey: market.marketKey };
      });
    },
    [market.marketKey],
  );
  const priceScaleAutoScale =
    priceScaleState.marketKey === market.marketKey
      ? priceScaleState.autoScale
      : true;

  useEffect(() => {
    if (!visible) {
      // Keep the retained chart mounted, but explicitly close the native sheet.
      // Its index=-1 prop handles initial placement, not a reliable close command.
      sheetRef.current?.close();
    }
  }, [visible]);

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
        {...bottomSheetProps}
        ref={sheetRef}
        animateOnMount={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={themedStyles.background}
        enableContentPanningGesture={false}
        enableDynamicSizing={false}
        enableHandlePanningGesture
        enablePanDownToClose
        handleIndicatorStyle={themedStyles.handleIndicator}
        handleStyle={themedStyles.handle}
        index={visible ? 0 : -1}
        onChange={handleSheetChange}
        snapPoints={[PERPS_PRO_KLINE_SHEET_HEIGHT]}
        style={themedStyles.modal}>
        <BottomSheetView style={themedStyles.content}>
          <PerpsProKlineToolbar
            disabled={!kline.hydrated}
            interval={kline.interval}
            onResetPriceScale={handleResetPriceScale}
            onSelect={kline.selectInterval}
            showPriceScaleReset={!priceScaleAutoScale}
          />
          <PerpsProKlineChart
            key={market.marketKey}
            chartRef={chartRef}
            feed={kline.feed}
            interval={kline.interval}
            liveFeedEnabled={enabled}
            market={chartMarket}
            onLoadOlder={kline.loadOlder}
            onPriceScaleAutoScaleChange={handlePriceScaleAutoScaleChange}
            publicationEnabled={
              publicationEnabled || (!enabled && preloadEnabled)
            }
            visible={visible}
          />
          <View style={themedStyles.footer} testID="perps-pro-kline-footer" />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
});

const styles = {
  chartContainer: {
    height: PERPS_PRO_KLINE_CHART_HEIGHT,
    width: '100%' as const,
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

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const chrome = getPerpsProBottomSheetChromeStyles(colors2024);

  return {
    ...chrome,
    modal: {
      ...chrome.modal,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    background: {
      ...chrome.background,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    content: {
      backgroundColor: colors2024['neutral-bg-1'],
      height: PERPS_PRO_KLINE_CONTENT_HEIGHT,
    },
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      height: PERPS_PRO_KLINE_FOOTER_HEIGHT,
    },
  };
});
