import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
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
  style?: StyleProp<ViewStyle>;
  backGroundColor?: string;
}

interface TPSLPriceLines {
  tpPrice?: number;
  slPrice?: number;
  liquidationPrice?: number;
  entryPrice?: number;
}

export interface TradingViewChartRef {
  setData: (data: CandleData) => void;
  updateCandleData: (data: CandleStick) => void;
  updateTPSLPriceLines: (data: TPSLPriceLines) => void;
}

const formatCandleItem = (candle: CandleStick) => {
  const timeInSeconds = Math.floor(candle.time);
  const formattedCandle = {
    time: timeInSeconds,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
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

const TradingViewCandleChart = forwardRef<TradingViewChartRef, ChartProps>(
  ({ style, height, onChartReady, backGroundColor }, ref) => {
    const localWebViewRef = useRef<LocalWebViewType>(null);
    const { styles, colors2024, isLight } = useTheme2024({ getStyle });
    const [webViewError, setWebViewError] = React.useState<string | null>(null);
    const [isChartReady, setIsChartReady] = React.useState(false);
    const { t } = useTranslation();

    // Chart colors based on theme
    const chartColors = useMemo(
      () => ({
        background:
          backGroundColor ||
          (isLight ? colors2024['neutral-bg-0'] : colors2024['neutral-bg-1']),
        text: colors2024['neutral-title-1'],
        border: colors2024['neutral-bg-5'],
        greenLineColor: 'rgba(42, 187, 127, 1)',
        redLineColor: 'rgba(227, 73, 53, 1)',
        highPriceLineColor: colors2024['neutral-body'],
        lowPriceLineColor: colors2024['neutral-body'],
        tooltip: {
          bg: isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
          title: colors2024['neutral-body'],
          value: colors2024['neutral-title-1'],
        },
      }),
      [backGroundColor, colors2024, isLight],
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
            case 'CHART_READY':
              setIsChartReady(true);
              onChartReady?.();
              break;
            case 'ATTR_LOGO_CLICK':
              openExternalUrl('https://www.tradingview.com');
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
      [onChartReady],
    );

    // Handle WebView errors
    const handleWebViewError = useCallback(
      (event: { nativeEvent?: { description?: string } }) => {
        const errorDescription =
          event.nativeEvent?.description || 'WebView error occurred';
        setWebViewError(errorDescription);
        console.error('WebView error:', event.nativeEvent);
      },
      [],
    );

    // Imperative API
    const handleSetData = useCallback(
      (data: CandleData) => {
        if (!isChartReady || !localWebViewRef.current) {
          return;
        }

        let dataToSend: any = null;
        let dataSource = 'none';

        // Prioritize real data over sample data
        if (data?.candles && data.candles.length > 0) {
          dataToSend = formatCandleData(data);
          dataSource = 'real';
        }

        if (dataToSend) {
          localWebViewRef.current.sendMessage?.({
            type: 'TRADINGVIEW_MESSAGE',
            data: {
              type: 'SET_CANDLESTICK_DATA',
              data: dataToSend,
              source: dataSource,
              showVolume: data.showVolume ?? false,
              fitContent: data.fitContent ?? false,
              noTime: data.noTime ?? false,
            },
          });
        }
      },
      [isChartReady],
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

    useImperativeHandle(ref, () => ({
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
            setWebViewKey(k => k + 1);
            setIsChartReady(false);
          }
          appStateRef = nextAppState;
        },
      );
      return () => subscription.remove();
    }, []);

    if (webViewError) {
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
          { height, width: '100%', minHeight: height },
        ]}>
        <LocalWebView
          key={webViewKey}
          ref={localWebViewRef}
          entryPath="/pages/tradingview-candle-chart.html"
          webviewSize={{ height }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
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
          }}
        />
      </View>
    );
  },
);

const getStyle = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
}));

export default TradingViewCandleChart;
