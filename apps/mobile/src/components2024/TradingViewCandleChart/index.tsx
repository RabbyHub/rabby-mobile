import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  Ref,
} from 'react';
import {
  AppState,
  AppStateStatus,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { CandleData, CandleStick } from './type';
import { openExternalUrl } from '@/core/utils/linking';
import { useAppLanguage } from '@/hooks/lang';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import {
  LocalWebView,
  type LocalWebView as LocalWebViewType,
} from '@/components/WebView/LocalWebView/LocalWebView';

interface ChartProps {
  height: number;
  onChartReady?: () => void;
  onChartError?: () => void;
  onDataApplied?: (data: CandleDataApplied) => void;
  onRequestOlderCandles?: (request: OlderCandlesRequest) => void;
  style?: StyleProp<ViewStyle>;
  backGroundColor?: string;
  variant?: 'perps-pro';
}

export type CandleDataApplied = {
  identity: string;
  revision: number;
};

export type OlderCandlesRequest = {
  earliestTime: number;
  identity: string;
};

interface TPSLPriceLines {
  tpPrice?: number;
  slPrice?: number;
  liquidationPrice?: number;
  entryPrice?: number;
}

export interface TradingViewChartRef {
  clearCrosshair: () => void;
  completeOlderCandlesRequest: (
    request: OlderCandlesRequest & { outcome: 'exhausted' | 'retry' },
  ) => void;
  setData: (data: CandleData) => void;
  updateCandleData: (data: CandleStick) => void;
  updateTPSLPriceLines: (data: TPSLPriceLines) => void;
}

const PERPS_PRO_KLINE_PROTOCOL_VERSION = 1;
const PERPS_PRO_KLINE_PROTOCOL_ERROR =
  'Perps Pro K-line resource protocol mismatch';

const formatCandleItem = (candle: CandleStick) => {
  const timeInSeconds = Math.floor(candle.time);
  const formattedCandle = {
    time: timeInSeconds,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    ...(candle.trades !== undefined ? { trades: candle.trades ?? null } : {}),
    ...(candle.quoteTurnover !== undefined
      ? { quoteTurnover: candle.quoteTurnover ?? null }
      : {}),
  };
  // Validate all values are valid numbers (volume is optional for aggregated candles like weekly)
  const isValid =
    !isNaN(formattedCandle.time) &&
    !isNaN(formattedCandle.open) &&
    !isNaN(formattedCandle.high) &&
    !isNaN(formattedCandle.low) &&
    !isNaN(formattedCandle.close) &&
    formattedCandle.open > 0 &&
    formattedCandle.high > 0 &&
    formattedCandle.low > 0 &&
    formattedCandle.close > 0;

  if (!isValid) {
    console.log('🚨 Invalid candle data:', candle, '→', formattedCandle);
    return null;
  }

  return formattedCandle;
};

const formatCandleData = (data: CandleData) => {
  if (!data?.candles) {
    return [];
  }
  const formatted = data.candles
    .map(formatCandleItem)
    .filter((candle): candle is NonNullable<typeof candle> => candle !== null)
    .sort((a, b) => a.time - b.time); // Sort by time ascending

  return formatted;
};

const TradingViewCandleChart = ({
  style,
  height,
  onChartReady,
  onChartError,
  onDataApplied,
  onRequestOlderCandles,
  backGroundColor,
  variant,
  ref,
}: ChartProps & { ref?: Ref<TradingViewChartRef> }) => {
  const localWebViewRef = useRef<LocalWebViewType>(null);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const [webViewError, setWebViewError] = React.useState<string | null>(null);
  const [isChartReady, setIsChartReady] = React.useState(false);
  const explicitSurfaceStyle = useMemo(
    () =>
      variant === 'perps-pro' && backGroundColor
        ? { backgroundColor: backGroundColor }
        : undefined,
    [backGroundColor, variant],
  );
  const supportsDataAppliedAckRef = useRef(false);
  const pendingLegacyAppliedFrameRef = useRef<number | null>(null);
  const protocolReloadAttemptedRef = useRef(false);
  const protocolErrorReportedRef = useRef(false);
  const { t } = useTranslation();

  const cancelPendingLegacyApplied = useCallback(() => {
    if (pendingLegacyAppliedFrameRef.current === null) {
      return;
    }
    cancelAnimationFrame(pendingLegacyAppliedFrameRef.current);
    pendingLegacyAppliedFrameRef.current = null;
  }, []);

  useEffect(
    () => () => {
      cancelPendingLegacyApplied();
    },
    [cancelPendingLegacyApplied],
  );

  // Chart colors based on theme
  const chartColors = useMemo(
    () => ({
      background:
        backGroundColor ||
        (variant === 'perps-pro'
          ? colors2024['neutral-bg-1']
          : isLight
          ? colors2024['neutral-bg-1']
          : colors2024['neutral-bg-2']),
      text: colors2024['neutral-title-1'],
      border: colors2024['neutral-bg-5'],
      secondaryText: colors2024['neutral-secondary'],
      greenLineColor:
        variant === 'perps-pro'
          ? colors2024['green-default']
          : 'rgba(42, 187, 127, 1)',
      redLineColor:
        variant === 'perps-pro'
          ? colors2024['red-default']
          : 'rgba(227, 73, 53, 1)',
      highPriceLineColor: colors2024['neutral-body'],
      lowPriceLineColor: colors2024['neutral-body'],
      emptyPrimary: colors2024['brand-light-1'],
      emptySecondary: colors2024['brand-light-2'],
      emptyStroke: colors2024['brand-disable'],
      ma: {
        7: colors2024['orange-default'],
        25: colors2024['red-default'],
        99: colors2024['brand-default'],
      },
      tooltip: {
        bg:
          variant === 'perps-pro'
            ? colors2024['neutral-bg-1']
            : isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-2'],
        border: colors2024['neutral-line'],
        title: colors2024['neutral-body'],
        value: colors2024['neutral-title-1'],
      },
      crosshairLabel: {
        background:
          variant === 'perps-pro' && !isLight
            ? colors2024['neutral-body']
            : colors2024['neutral-black'],
        text:
          variant === 'perps-pro'
            ? colors2024['neutral-contrast']
            : colors2024['neutral-InvertHighlight'],
      },
    }),
    [backGroundColor, colors2024, isLight, variant],
  );

  // Chart description labels
  const chartDescription = useMemo(
    () => ({
      tp: t('component.kline.tp'),
      entry: t('component.kline.entry'),
      sl: t('component.kline.sl'),
      liq: t('component.kline.liq'),
      high: t('component.kline.high'),
      low: t('component.kline.low'),
      time: t('component.kline.time'),
      open: t('component.kline.open'),
      close: t('component.kline.close'),
      chg: t('component.kline.chg'),
      chgPercent: t('component.kline.chgPercent'),
      volume: t('component.kline.volume'),
      vol: t('component.kline.vol'),
      range: t('component.kline.range'),
      txn: t('component.kline.txn'),
      empty: t('page.tokenDetail.marketInfo.empty'),
    }),
    [t],
  );

  // Send theme to WebView when chart is ready
  useEffect(() => {
    if (isChartReady && localWebViewRef.current) {
      localWebViewRef.current.sendMessage?.({
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'UPDATE_THEME',
          colors: chartColors,
          description: chartDescription,
        },
      });
    }
  }, [isChartReady, chartColors, chartDescription]);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        switch (message.type) {
          case 'CHART_READY': {
            cancelPendingLegacyApplied();
            if (
              variant === 'perps-pro' &&
              (!Number.isInteger(
                message.capabilities?.perpsProKlineProtocolVersion,
              ) ||
                message.capabilities.perpsProKlineProtocolVersion <
                  PERPS_PRO_KLINE_PROTOCOL_VERSION)
            ) {
              supportsDataAppliedAckRef.current = false;
              setIsChartReady(false);
              if (
                !protocolReloadAttemptedRef.current &&
                typeof localWebViewRef.current?.reload === 'function'
              ) {
                protocolReloadAttemptedRef.current = true;
                localWebViewRef.current.reload();
                break;
              }
              if (!protocolErrorReportedRef.current) {
                protocolErrorReportedRef.current = true;
                console.error(
                  'TradingViewChart: Perps Pro K-line protocol mismatch',
                  {
                    actualVersion:
                      message.capabilities?.perpsProKlineProtocolVersion ??
                      null,
                    requiredVersion: PERPS_PRO_KLINE_PROTOCOL_VERSION,
                  },
                );
                setWebViewError(PERPS_PRO_KLINE_PROTOCOL_ERROR);
                onChartError?.();
              }
              break;
            }
            supportsDataAppliedAckRef.current =
              message.capabilities?.candleDataAppliedAck === true;
            setIsChartReady(true);
            onChartReady?.();
            break;
          }
          case 'ATTR_LOGO_CLICK':
            openExternalUrl('https://www.tradingview.com');
            break;
          case 'CANDLE_DATA_APPLIED':
            if (
              typeof message.identity === 'string' &&
              Number.isInteger(message.revision)
            ) {
              cancelPendingLegacyApplied();
              onDataApplied?.({
                identity: message.identity,
                revision: message.revision,
              });
            }
            break;
          case 'REQUEST_OLDER_CANDLES':
            if (
              typeof message.identity === 'string' &&
              Number.isFinite(message.earliestTime)
            ) {
              onRequestOlderCandles?.({
                earliestTime: message.earliestTime,
                identity: message.identity,
              });
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.error(
          'TradingViewChart: Error parsing WebView message:',
          error,
        );
      }
    },
    [
      cancelPendingLegacyApplied,
      onChartReady,
      onChartError,
      onDataApplied,
      onRequestOlderCandles,
      variant,
    ],
  );

  // Handle WebView errors
  const handleWebViewError = useCallback(
    (event: { nativeEvent?: { description?: string } }) => {
      const errorDescription =
        event.nativeEvent?.description || 'WebView error occurred';
      cancelPendingLegacyApplied();
      setWebViewError(errorDescription);
      onChartError?.();
      console.error('WebView error:', event.nativeEvent);
    },
    [cancelPendingLegacyApplied, onChartError],
  );

  // Imperative API
  const handleSetData = useCallback(
    (data: CandleData) => {
      if (!isChartReady || !localWebViewRef.current) {
        return;
      }

      const dataToSend = formatCandleData(data);
      const dataSource = dataToSend.length > 0 ? 'real' : 'empty';

      localWebViewRef.current.sendMessage?.({
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'SET_CANDLESTICK_DATA',
          data: dataToSend,
          source: dataSource,
          showVolume: data.showVolume ?? false,
          fitContent: data.fitContent ?? false,
          noTime: data.noTime ?? false,
          ...(data.identity !== undefined ? { identity: data.identity } : {}),
          ...(data.revision !== undefined ? { revision: data.revision } : {}),
          ...(data.proConfig ? { proConfig: data.proConfig } : {}),
          ...(data.preserveVisibleRange ? { preserveVisibleRange: true } : {}),
        },
      });

      if (
        typeof data.identity === 'string' &&
        Number.isInteger(data.revision) &&
        !supportsDataAppliedAckRef.current
      ) {
        cancelPendingLegacyApplied();
        const identity = data.identity;
        const revision = data.revision!;
        pendingLegacyAppliedFrameRef.current = requestAnimationFrame(() => {
          pendingLegacyAppliedFrameRef.current = null;
          onDataApplied?.({ identity, revision });
        });
      }
    },
    [cancelPendingLegacyApplied, isChartReady, onDataApplied],
  );

  const handleUpdateCandleData = useCallback(
    (data: CandleStick) => {
      if (!isChartReady || !localWebViewRef.current) {
        return;
      }

      const dataToSend = formatCandleItem(data);

      if (dataToSend) {
        localWebViewRef.current.sendMessage?.({
          type: 'TRADINGVIEW_MESSAGE',
          data: {
            type: 'UPDATE_CANDLESTICK_DATA',
            data: dataToSend,
          },
        });
      }
    },
    [isChartReady],
  );

  const handleUpdateTPSLPriceLines = useCallback(
    (data: TPSLPriceLines) => {
      if (!isChartReady || !localWebViewRef.current) {
        return;
      }
      localWebViewRef.current.sendMessage?.({
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'UPDATE_TPSL_PRICE_LINES',
          data: data,
        },
      });
    },
    [isChartReady],
  );

  const handleClearCrosshair = useCallback(() => {
    if (!isChartReady || !localWebViewRef.current) {
      return;
    }
    localWebViewRef.current.sendMessage?.({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'CLEAR_CROSSHAIR',
      },
    });
  }, [isChartReady]);

  const handleCompleteOlderCandlesRequest = useCallback(
    (request: OlderCandlesRequest & { outcome: 'exhausted' | 'retry' }) => {
      if (!isChartReady || !localWebViewRef.current) {
        return;
      }
      localWebViewRef.current.sendMessage?.({
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'COMPLETE_OLDER_CANDLES_REQUEST',
          ...request,
        },
      });
    },
    [isChartReady],
  );

  useImperativeHandle(ref, () => ({
    clearCrosshair: handleClearCrosshair,
    completeOlderCandlesRequest: handleCompleteOlderCandlesRequest,
    setData: handleSetData,
    updateCandleData: handleUpdateCandleData,
    updateTPSLPriceLines: handleUpdateTPSLPriceLines,
  }));

  // Remount WebView when app returns to foreground after being background for 30+ seconds
  const [webViewKey, setWebViewKey] = React.useState(0);
  useEffect(() => {
    let appStateRef = AppState.currentState;
    let backgroundTimestamp = 0;
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState.match(/inactive|background/)) {
          backgroundTimestamp = Date.now();
        } else if (
          appStateRef.match(/inactive|background/) &&
          nextAppState === 'active' &&
          Date.now() - backgroundTimestamp > 30000
        ) {
          cancelPendingLegacyApplied();
          supportsDataAppliedAckRef.current = false;
          protocolReloadAttemptedRef.current = false;
          protocolErrorReportedRef.current = false;
          setWebViewKey(k => k + 1);
          setIsChartReady(false);
        }
        appStateRef = nextAppState;
      },
    );
    return () => subscription.remove();
  }, [cancelPendingLegacyApplied]);

  if (webViewError) {
    if (variant === 'perps-pro') {
      return (
        <View
          style={[
            styles.container,
            style,
            explicitSurfaceStyle,
            { height, width: '100%', minHeight: height },
          ]}
        />
      );
    }
    return (
      <View style={{ height }}>
        <Text>Chart Error: {webViewError}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        style,
        explicitSurfaceStyle,
        { height, width: '100%', minHeight: height },
      ]}>
      <LocalWebView
        key={webViewKey}
        ref={localWebViewRef}
        entryPath="/pages/tradingview-candle-chart.html"
        webviewSize={{ height }}
        onMessage={handleWebViewMessage}
        onError={handleWebViewError}
        backGroundColor={backGroundColor}
        style={explicitSurfaceStyle}
        i18nTexts={{
          'component.kline.tp': t('component.kline.tp'),
          'component.kline.entry': t('component.kline.entry'),
          'component.kline.sl': t('component.kline.sl'),
          'component.kline.liq': t('component.kline.liq'),
          'component.kline.high': t('component.kline.high'),
          'component.kline.low': t('component.kline.low'),
          'component.kline.time': t('component.kline.time'),
          'component.kline.open': t('component.kline.open'),
          'component.kline.close': t('component.kline.close'),
          'component.kline.chg': t('component.kline.chg'),
          'component.kline.chgPercent': t('component.kline.chgPercent'),
          'component.kline.volume': t('component.kline.volume'),
          'component.kline.vol': t('component.kline.vol'),
          'component.kline.range': t('component.kline.range'),
          'component.kline.txn': t('component.kline.txn'),
          'component.kline.empty': t('page.tokenDetail.marketInfo.empty'),
        }}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
}));

export default TradingViewCandleChart;
