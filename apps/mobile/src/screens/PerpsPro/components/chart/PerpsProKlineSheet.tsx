import { AppBottomSheetModal } from '@/components';
import TradingViewCandleChart, {
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
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

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
}> = ({ feed, interval, market }) => {
  const chartRef = useRef<TradingViewChartRef>(null);
  const lastSentRef = useRef<{
    identity: string;
    readyVersion: number;
  } | null>(null);
  const lastClearedIdentityRef = useRef<string | null>(null);
  const [readyVersion, setReadyVersion] = useState(0);
  const [displayedSnapshot, setDisplayedSnapshot] = useState<{
    identity: string;
    readyVersion: number;
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
      chartRef.current?.setData(chartData);
    }
    lastSentRef.current = {
      identity: feed.identity,
      readyVersion,
    };
    setDisplayedSnapshot(current =>
      current?.identity === feed.identity &&
      current.readyVersion === readyVersion
        ? current
        : {
            identity: feed.identity,
            readyVersion,
          },
    );
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

  const showSkeleton =
    chartFailed ||
    readyVersion === 0 ||
    (!isIntervalSwitchLoading && !isCurrentFeedDisplayed);

  return (
    <View style={styles.chartContainer}>
      <TradingViewCandleChart
        ref={chartRef}
        height={PERPS_PRO_KLINE_CHART_HEIGHT}
        onChartError={handleChartError}
        onChartReady={handleChartReady}
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
}> = ({ enabled, market, onClose }) => {
  const { colors2024, styles: themedStyles } = useTheme2024({
    getStyle,
  });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const kline = usePerpsProKline({
    coin: market.canonicalCoin,
    enabled,
  });
  const bottomSheetProps = useMemo(
    () =>
      makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      }),
    [colors2024],
  );

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  return (
    <AppBottomSheetModal
      {...bottomSheetProps}
      backdropProps={{ pressBehavior: 'close' }}
      backgroundStyle={themedStyles.background}
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      enableHandlePanningGesture
      enablePanDownToClose
      handleIndicatorStyle={themedStyles.handleIndicator}
      handleStyle={themedStyles.handle}
      onDismiss={onClose}
      ref={modalRef}
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
        />
        <View style={themedStyles.footer} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const styles = {
  chartContainer: {
    height: PERPS_PRO_KLINE_CHART_HEIGHT,
    width: '100%' as const,
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
