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
import type { PerpsCandleDataInterval } from '@/constant/perps';
import type {
  PerpsCandleFeedSnapshot,
  PerpsCandleHistoryLoadResult,
} from '@/hooks/perps/candles/usePerpsCandleFeed';
import RcIconClose from '@/assets2024/icons/perps/PerpsProKline/close.svg';
import RcIconReset from '@/assets2024/icons/perps/PerpsSimpleChart/reset.svg';
import { useTheme2024 } from '@/hooks/theme';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

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

export const PERPS_PRO_KLINE_HEADER_HEIGHT = 58;
const PERPS_PRO_KLINE_HANDLE_AREA_HEIGHT =
  PERPS_PRO_KLINE_HEADER_HEIGHT - PERPS_PRO_KLINE_TOOLBAR_HEIGHT;
const PERPS_PRO_KLINE_MIN_BOTTOM_PADDING = 16;
export const PERPS_PRO_KLINE_CONTENT_HEIGHT = PERPS_PRO_KLINE_CHART_HEIGHT;
export const PERPS_PRO_KLINE_SHEET_HEIGHT =
  PERPS_PRO_KLINE_HEADER_HEIGHT +
  PERPS_PRO_KLINE_CONTENT_HEIGHT +
  PERPS_PRO_KLINE_MIN_BOTTOM_PADDING;
// Docked panel height used to reserve bottom padding in the list beneath it.
export const getPerpsProKlinePanelHeight = (bottomInset: number) =>
  PERPS_PRO_KLINE_HEADER_HEIGHT +
  PERPS_PRO_KLINE_CONTENT_HEIGHT +
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

type KlineChartMarket = Pick<
  PerpsProMarketDescriptor,
  'canonicalCoin' | 'displayBase' | 'quoteAsset'
> & { priceDecimals: number };

const PerpsProKlineChart: React.FC<{
  chartRef: React.RefObject<TradingViewChartRef | null>;
  feed: PerpsCandleFeedSnapshot;
  interval: PerpsCandleDataInterval;
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
        onPerpsProViewportChange={onPriceScaleAutoScaleChange}
        onRequestOlderCandles={handleRequestOlderCandles}
        variant="perps-pro"
      />
      {showSkeleton ? <PerpsProKlineSkeleton overlay /> : null}
    </View>
  );
});

type PerpsProKlineHeaderState = {
  disabled: boolean;
  interval: PerpsCandleDataInterval;
  onClose: () => void;
  onSelect: (interval: PerpsCandleDataInterval) => void;
};

// Keep the component identity stable for BottomSheet's handleComponent while
// reading the latest control-plane state through a ref.
const createPerpsProKlineHeader = (
  getState: () => PerpsProKlineHeaderState | null,
) =>
  React.memo(function PerpsProKlineHeader() {
    const state = getState();
    const { colors2024, styles: themedStyles } = useTheme2024({ getStyle });
    const { t } = useTranslation();

    if (!state) {
      return null;
    }

    return (
      <View style={themedStyles.header} testID="perps-pro-kline-header">
        <View style={themedStyles.indicator} />
        <Pressable
          accessibilityLabel={t('global.closeButton')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={state.onClose}
          style={themedStyles.closeButton}
          testID="perps-pro-kline-close">
          <RcIconClose
            color={colors2024['neutral-secondary']}
            height={20}
            width={20}
          />
        </Pressable>
        <PerpsProKlineToolbar
          disabled={state.disabled}
          interval={state.interval}
          onSelect={state.onSelect}
        />
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
  const sheetRef = useRef<BottomSheetModalMethods>(null);
  const presentedRef = useRef(false);
  const chartRef = useRef<TradingViewChartRef>(null);
  const [priceScaleState, setPriceScaleState] = useState({
    autoScale: true,
    marketKey: market.marketKey,
  });
  const { colors2024, styles: themedStyles } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  const kline = usePerpsProKline({
    coin: market.canonicalCoin,
    enabled,
    preloadEnabled,
    publicationEnabled,
  });
  const { bottom: bottomInset } = useSafeAreaInsets();
  const panelHeight = getPerpsProKlinePanelHeight(bottomInset);
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
    chartRef.current?.resetPerpsProViewport();
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
  const headerState = useMemo<PerpsProKlineHeaderState>(
    () => ({
      disabled: !kline.hydrated,
      interval: kline.interval,
      onClose,
      onSelect: kline.selectInterval,
    }),
    [kline.hydrated, kline.interval, kline.selectInterval, onClose],
  );
  const headerStateRef = useRef<PerpsProKlineHeaderState | null>(null);
  headerStateRef.current = headerState;
  const PerpsProKlineHeader = useMemo(
    () => createPerpsProKlineHeader(() => headerStateRef.current),
    [],
  );

  // Present the modal once even while hidden. BottomSheetModal only mounts its
  // portal after present(), so this keeps the expensive chart prewarmed while
  // index=-1 keeps the panel off-screen. Subsequent opens/closes are driven by
  // the same index prop used by the previous inline BottomSheet.
  useLayoutEffect(() => {
    const modal = sheetRef.current;
    if (!presentedRef.current) {
      presentedRef.current = true;
      modal?.present();
    }
    return () => {
      presentedRef.current = false;
      modal?.dismiss();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      // Keep the retained chart mounted, but explicitly close the native sheet.
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
      <BottomSheetModal
        {...bottomSheetProps}
        ref={sheetRef}
        animateOnMount={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={themedStyles.background}
        enableContentPanningGesture={false}
        enableDismissOnClose={false}
        enableDynamicSizing={false}
        enableHandlePanningGesture
        enablePanDownToClose
        handleComponent={PerpsProKlineHeader}
        handleIndicatorStyle={undefined}
        handleStyle={undefined}
        index={visible ? 0 : -1}
        onChange={handleSheetChange}
        snapPoints={[panelHeight]}
        style={themedStyles.modal}>
        <BottomSheetView style={themedStyles.content}>
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
          {!priceScaleAutoScale ? (
            <Pressable
              accessibilityLabel={t('page.perpsDetail.simpleChart.resetChart')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleResetPriceScale}
              style={styles.resetButton}
              testID="perps-pro-kline-reset">
              <RcIconReset width={20} height={20} />
            </Pressable>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
});

const styles = {
  resetButton: {
    alignItems: 'center' as const,
    height: 32,
    justifyContent: 'center' as const,
    position: 'absolute' as const,
    right: 18,
    top: 206,
    width: 32,
  },
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
    header: {
      backgroundColor: colors2024['neutral-bg-1'],
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
  };
});
