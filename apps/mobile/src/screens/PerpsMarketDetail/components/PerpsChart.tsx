import { accountHeaderQuote, type AccountHeaderQuote } from './account/model';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import type { NativeGesture } from 'react-native-gesture-handler';
import { PerpsSimplePriceAxis } from './chart/PerpsSimplePriceAxis';
import { useTranslation } from 'react-i18next';
import { colord } from 'colord';
import { useMemoizedFn } from 'ahooks';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import type { SimpleChartPreference } from '@/constant/perpsSimpleChart';
import TradingViewCandleChart from '@/components2024/TradingViewCandleChart';
import type {
  SimpleChartConfig,
  SimpleChartFill,
} from '@/components2024/TradingViewCandleChart/type';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import type { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Reset from '@/assets2024/icons/perps/PerpsSimpleChart/reset.svg';
import Latest from '@/assets2024/icons/perps/PerpsSimpleChart/latest.svg';
import { PerpsSimpleChartHeader } from './chart/PerpsSimpleChartHeader';
import { PerpsSimpleChartToolbar } from './chart/PerpsSimpleChartToolbar';
import { PerpsSimpleCandleIntervalSheet } from './chart/PerpsSimpleCandleIntervalSheet';
import { usePerpsSimpleChart } from './chart/usePerpsSimpleChart';
import { projectSimpleFills } from './chart/model';
import { SIMPLE_CHART_COLORS } from './chart/visual';
import { PerpsSimpleChartLoading } from './chart/PerpsSimpleChartLoading';

const EMPTY_FILLS: SimpleChartFill[] = [];
const SIMPLE_CHART_HEIGHT = 320;

export const PerpsChart = React.memo(function PerpsChart({
  marketName,
  scrollGesture,
  currentAssetCtx,
  activeAssetCtx,
  lineTagInfo,
  accountKey,
  history,
  onPriceLayout,
  onHeaderQuote,
}: {
  onPriceLayout?: (node: View) => void;
  onHeaderQuote?: (quote: AccountHeaderQuote, active: boolean) => void;
  marketName: string;
  scrollGesture?: NativeGesture;
  currentAssetCtx?: MarketData;
  activeAssetCtx?: WsActiveAssetCtx['ctx'] | null;
  lineTagInfo: {
    tpPrice: number;
    slPrice: number;
    liquidationPrice: number;
    entryPrice: number;
  };
  accountKey: string;
  history: readonly { time: number; side: string }[];
}) {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const decimals = currentAssetCtx?.pxDecimals ?? 2;
  const config = useMemo<
    Omit<SimpleChartConfig, 'style' | 'range' | 'interval'>
  >(
    () => ({
      priceDecimals: decimals,
      nativePriceAxis: Platform.OS === 'ios',
      showTradeMarkers: false,
      colors: {
        background: colors2024['neutral-bg-0'],
        titleOutline: colors2024['neutral-bg-1'],
        selectionBackground: isLight
          ? colors2024['neutral-black']
          : colors2024['neutral-body'],
        selectionText: colors2024['neutral-contrast'],
        text: colors2024['neutral-title-1'],
        secondary: colors2024['neutral-secondary'],
        grid: colors2024['neutral-line'],
        entry: colors2024['neutral-foot'],
        entryBackground: colors2024['neutral-info'],
        entryText: colors2024['neutral-body'],
        liquidation: colors2024['orange-default'],
        contrast: colors2024['neutral-InvertHighlight'],
        up: SIMPLE_CHART_COLORS.up,
        down: SIMPLE_CHART_COLORS.down,
        accent: SIMPLE_CHART_COLORS.accent,
        areaTop: colord(SIMPLE_CHART_COLORS.areaFill).alpha(0.3).toRgbString(),
        areaBottom: colord(SIMPLE_CHART_COLORS.areaFill).alpha(0).toRgbString(),
      },
      labels: {
        entry: t('page.perpsDetail.simpleChart.averageEntry'),
        tp: t('page.perpsDetail.simpleChart.takeProfit'),
        sl: t('page.perpsDetail.simpleChart.stopLoss'),
        liq: t('page.perpsDetail.simpleChart.liquidation'),
        empty: t('page.tokenDetail.marketInfo.empty'),
        buy: t('page.perpsDetail.simpleChart.buy'),
        sell: t('page.perpsDetail.simpleChart.sell'),
      },
    }),
    [colors2024, decimals, isLight, t],
  );
  const fills = useMemo(
    () => (config.showTradeMarkers ? projectSimpleFills(history) : EMPTY_FILLS),
    [config.showTradeMarkers, history],
  );
  const chart = usePerpsSimpleChart({
    coin: marketName,
    config,
    accountKey,
    fills,
    prices: lineTagInfo,
  });
  const [sheetVisible, setSheetVisible] = useState(false);
  const closeSheet = useMemoizedFn(() => setSheetVisible(false));
  const openSheet = useMemoizedFn(() => setSheetVisible(true));
  const changePreference = useMemoizedFn((next: SimpleChartPreference) => {
    if (
      next.style === chart.preference.style &&
      next.range === chart.preference.range
    )
      chart.reset();
    chart.updatePreference(
      next.style !== chart.preference.style
        ? { ...chart.requestedPreference, style: next.style }
        : next,
    );
  });
  const confirmInterval = useMemoizedFn((interval: PerpsCandleDataInterval) => {
    if (
      interval === chart.preference.interval &&
      chart.preference.range === null
    )
      chart.reset();
    chart.updatePreference({ ...chart.preference, range: null, interval });
  });
  useEffect(() => {
    if (!chart.active) setSheetVisible(false);
  }, [chart.active]);
  const ctx = activeAssetCtx ?? currentAssetCtx;
  const headerQuote = useMemo(
    () =>
      accountHeaderQuote(
        Number(activeAssetCtx?.markPx || currentAssetCtx?.markPx || 0),
        Number(ctx?.prevDayPx),
        decimals,
      ),
    [activeAssetCtx?.markPx, currentAssetCtx?.markPx, ctx?.prevDayPx, decimals],
  );
  useEffect(() => {
    onHeaderQuote?.(headerQuote, chart.active);
  }, [headerQuote, chart.active, onHeaderQuote]);
  return (
    <View style={styles.root}>
      <PerpsSimpleChartHeader
        key={marketName}
        onPriceLayout={onPriceLayout}
        active={chart.active}
        markPrice={Number(
          activeAssetCtx?.markPx || currentAssetCtx?.markPx || 0,
        )}
        decimals={decimals}
        range={chart.preference.range}
        rangeReference={chart.rangeReference}
        shortHistory={chart.shortHistory}
        referenceLoading={chart.referenceLoading}
        marketLoading={
          chart.loadingBusy &&
          (chart.feed.status === 'idle' ||
            chart.feed.status === 'loading' ||
            !ctx)
        }
        prevDayPx={Number(ctx?.prevDayPx)}
        openInterest={Number(ctx?.openInterest) * Number(ctx?.markPx)}
        volume={Number(ctx?.dayNtlVlm)}
        selection={chart.selection}
        selectionTimeText={chart.selectionTimeText}
        ohlcMeasureText={chart.ohlcMeasureText}
        style={chart.preference.style}
      />
      <View style={styles.chart}>
        <TradingViewCandleChart
          ref={chart.chartRef}
          variant="perps-simple"
          style={!chart.hasAppliedData ? styles.hidden : undefined}
          height={SIMPLE_CHART_HEIGHT}
          backGroundColor={colors2024['neutral-bg-0']}
          onChartReady={chart.onChartReady}
          onChartLoading={chart.onChartLoading}
          onChartError={chart.onChartError}
          onSimpleEvent={chart.onSimpleEvent}
        />
        {scrollGesture && chart.priceAxisOwner && (
          <PerpsSimplePriceAxis
            key={chart.priceAxisOwner}
            scrollGesture={scrollGesture}
            owner={chart.priceAxisOwner}
            paneWidth={chart.paneWidth}
            paneHeight={chart.paneHeight}
            onCommand={chart.onPriceAxisCommand}
          />
        )}
        {chart.active && chart.loading && <View style={styles.touchGuard} />}
        {chart.active && chart.loading && (
          <PerpsSimpleChartLoading
            busy={chart.loadingBusy}
            hasData={chart.hasAppliedData}
            onRetry={chart.retry}
          />
        )}
        {chart.resetVisible && (
          <Pressable
            style={[
              styles.chartButton,
              {
                left: 12 + chart.paneWidth / 2 - 10,
                top: 12 + chart.paneHeight - 28,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('page.perpsDetail.simpleChart.resetChart')}
            onPress={chart.reset}>
            <Reset />
          </Pressable>
        )}
        {chart.latestVisible && (
          <Pressable
            style={[
              styles.chartButton,
              {
                left: 12 + chart.paneWidth - 28,
                top: 12 + chart.paneHeight - 28,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('page.perpsDetail.simpleChart.backToLatest')}
            onPress={chart.latest}>
            <Latest />
          </Pressable>
        )}
      </View>
      <PerpsSimpleChartToolbar
        preference={chart.preference}
        requestedPreference={chart.requestedPreference}
        onChange={changePreference}
        onInterval={openSheet}
        onPrefetch={chart.prefetch}
      />
      <PerpsSimpleCandleIntervalSheet
        visible={sheetVisible}
        selected={chart.requestedPreference.interval}
        onPrefetch={chart.prefetch}
        onClose={closeSheet}
        onConfirm={confirmInterval}
      />
    </View>
  );
});
const getStyle = createGetStyles2024(() => ({
  // Keep the full 40px toolbar inside this parent's touch bounds while using
  // the surrounding whitespace; the visible 24px controls keep their position.
  root: { marginHorizontal: -12, marginBottom: -8, gap: 8 },
  chart: { height: SIMPLE_CHART_HEIGHT },
  hidden: { opacity: 0 },
  touchGuard: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  chartButton: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
}));
