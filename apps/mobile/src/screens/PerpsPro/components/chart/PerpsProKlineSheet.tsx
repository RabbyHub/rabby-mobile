import TradingViewCandleChart, {
  type CandleDataApplied,
  type TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import type {
  CandleData,
  CandleStick,
} from '@/components2024/TradingViewCandleChart/type';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import type { PerpsCandleInterval } from '@/constant/perps';
import type { PerpsCandleFeedSnapshot } from '@/hooks/perps/candles/usePerpsCandleFeed';
import { useTheme2024 } from '@/hooks/theme';
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

import type { PerpsProMarket } from '../../model/market';
import { usePerpsProKline } from '../../scene/usePerpsProKline';
import {
  PERPS_PRO_KLINE_CHART_HEIGHT,
  PerpsProKlineSkeleton,
} from './PerpsProKlineSkeleton';
import { PerpsProKlineToolbar } from './PerpsProKlineToolbar';

export const PERPS_PRO_KLINE_SHEET_HEIGHT = 286;
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
  feed: PerpsCandleFeedSnapshot;
  interval: PerpsCandleInterval;
  market: PerpsProMarket;
  visible: boolean;
}> = ({ feed, interval, market, visible }) => {
  const chartRef = useRef<TradingViewChartRef>(null);
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
      showVolume: true,
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
    feed.identity,
    feed.status,
    feed.updateType,
    readyVersion,
  ]);

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
  }, [feed.identity, isIntervalSwitchLoading]);

  useEffect(() => {
    if (visible) {
      return;
    }
    chartRef.current?.clearCrosshair();
  }, [visible]);

  const showSkeleton =
    chartFailed ||
    readyVersion === 0 ||
    (!isIntervalSwitchLoading &&
      !isReplacementPending &&
      !isCurrentFeedDisplayed);

  return (
    <View style={styles.chartContainer}>
      <TradingViewCandleChart
        ref={chartRef}
        height={PERPS_PRO_KLINE_CHART_HEIGHT}
        onChartError={handleChartError}
        onChartReady={handleChartReady}
        onDataApplied={handleDataApplied}
        variant="perps-pro"
      />
      {showSkeleton ? <PerpsProKlineSkeleton overlay /> : null}
    </View>
  );
};

export const PerpsProKlineSheet: React.FC<{
  enabled: boolean;
  market: PerpsProMarket;
  onClose: () => void;
  preloadEnabled?: boolean;
  visible?: boolean;
}> = ({
  enabled,
  market,
  onClose,
  preloadEnabled = enabled,
  visible = true,
}) => {
  const { colors2024, styles: themedStyles } = useTheme2024({
    getStyle,
  });
  const kline = usePerpsProKline({
    coin: market.canonicalCoin,
    enabled,
    preloadEnabled,
  });
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
            onSelect={kline.selectInterval}
          />
          <PerpsProKlineChart
            key={market.marketKey}
            feed={kline.feed}
            interval={kline.interval}
            market={market}
            visible={visible}
          />
          <View style={themedStyles.footer} />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modal: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  background: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 40,
    paddingBottom: 19,
    paddingTop: 17,
  },
  handleIndicator: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  content: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: PERPS_PRO_KLINE_SHEET_HEIGHT - 40,
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 40,
  },
}));
