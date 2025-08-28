import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Platform, SafeAreaView, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { createTradingViewChartTemplate } from './template';
import { CandleData, CandleStick } from './type';

interface ChartProps {
  height: number;
  onChartReady?: () => void;
}

export interface TradingViewChartRef {
  setData: (data: CandleData) => void;
  updateCandleData: (data: CandleStick) => void;
}

const baseWebViewProps = {
  javaScriptEnabled: true,
  domStorageEnabled: true,
  originWhitelist: ['*'],
  mixedContentMode: 'compatibility' as const,
  startInLoadingState: true,
  scrollEnabled: false,
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
  scalesPageToFit: false,
  webviewDebuggingEnabled: __DEV__,
};
const iosWebViewProps = {
  ...baseWebViewProps,
  allowsInlineMediaPlayback: true,
  mediaPlaybackRequiresUserAction: false,
  cacheEnabled: false,
  incognito: true,
  bounces: false,
  allowsFullscreenVideo: false,
  allowsBackForwardNavigationGestures: false,
  dataDetectorTypes: 'none' as const,
};
const androidWebViewProps = {
  ...baseWebViewProps,
};

const formatCandleItem = (candle: CandleStick) => {
  const timeInSeconds = Math.floor(candle.time / 1000);
  const formattedCandle = {
    time: timeInSeconds,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
  // Validate all values are valid numbers
  const isValid =
    !isNaN(formattedCandle.time) &&
    !isNaN(formattedCandle.open) &&
    !isNaN(formattedCandle.high) &&
    !isNaN(formattedCandle.low) &&
    !isNaN(formattedCandle.close) &&
    !isNaN(formattedCandle.volume) &&
    formattedCandle.open > 0 &&
    formattedCandle.high > 0 &&
    formattedCandle.low > 0 &&
    formattedCandle.close > 0 &&
    formattedCandle.volume > 0;

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
  ({ height, onChartReady }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const { styles, colors2024, isLight } = useTheme2024({ getStyle });
    const [webViewError, setWebViewError] = useState<string | null>(null);
    const [isChartReady, setIsChartReady] = useState(false);

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
            case 'PRICE_LINES_UPDATE':
              break;
            case 'INTERVAL_UPDATED':
              break;
            case 'WEBVIEW_TEST':
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

    const handleSetData = useCallback(
      (data: CandleData) => {
        if (!isChartReady || !webViewRef.current) {
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
          const message = {
            type: 'SET_CANDLESTICK_DATA',
            data: dataToSend,
            source: dataSource,
            showVolume: data.showVolume ?? false,
          };
          webViewRef.current.postMessage(JSON.stringify(message));
        }
      },
      [isChartReady],
    );

    const handleUpdateCandleData = useCallback(
      (data: CandleStick) => {
        if (!isChartReady || !webViewRef.current) {
          return;
        }

        let dataToSend: any = null;

        if (data) {
          dataToSend = formatCandleItem(data);
        }

        if (dataToSend) {
          const message = {
            type: 'UPDATE_CANDLESTICK_DATA',
            data: dataToSend,
          };
          webViewRef.current.postMessage(JSON.stringify(message));
        }
      },
      [isChartReady],
    );

    useImperativeHandle(ref, () => ({
      setData: handleSetData,
      updateCandleData: handleUpdateCandleData,
    }));

    const htmlContent = useMemo(
      () =>
        createTradingViewChartTemplate({
          background: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
          text: colors2024['neutral-title-1'],
          border: colors2024['neutral-bg-5'],
        }),
      [colors2024, isLight],
    );

    if (webViewError) {
      return (
        <View style={{ height }}>
          <Text>Chart Error: {webViewError}</Text>
        </View>
      );
    }

    return (
      <SafeAreaView
        style={[
          styles.container,
          { height, width: '100%', minHeight: height },
        ]}>
        <WebView
          ref={webViewRef}
          style={styles.webView}
          source={{ html: htmlContent }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          {...(Platform.OS === 'ios' ? iosWebViewProps : androidWebViewProps)}
        />
      </SafeAreaView>
    );
  },
);

const getStyle = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  webView: {
    flex: 1,
  },
}));

export default TradingViewCandleChart;
