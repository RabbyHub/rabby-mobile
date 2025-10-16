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
import { Platform, StyleProp, Text, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { createTradingViewChartTemplate } from './template';
import { CandleData, CandleStick } from './type';
import { openExternalUrl } from '@/core/utils/linking';
import { useTranslation } from 'react-i18next';
import { IS_IOS } from '@/core/native/utils';
import { WEBVIEW_BASEURL } from '@/core/storage/webviewAssets';

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
  const timeInSeconds = Math.floor(candle.time);
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
  ({ style, height, onChartReady, backGroundColor }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const { styles, colors2024, isLight } = useTheme2024({ getStyle });
    const [webViewError, setWebViewError] = useState<string | null>(null);
    const [isChartReady, setIsChartReady] = useState(false);
    const { t } = useTranslation();

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
            fitContent: data.fitContent ?? false,
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

    const handleUpdateTPSLPriceLines = useCallback(
      (data: TPSLPriceLines) => {
        if (!isChartReady || !webViewRef.current) {
          return;
        }
        const message = {
          type: 'UPDATE_TPSL_PRICE_LINES',
          data: data,
        };
        webViewRef.current.postMessage(JSON.stringify(message));
      },
      [isChartReady],
    );

    useImperativeHandle(ref, () => ({
      setData: handleSetData,
      updateCandleData: handleUpdateCandleData,
      updateTPSLPriceLines: handleUpdateTPSLPriceLines,
    }));

    const htmlContent = useMemo(
      () =>
        createTradingViewChartTemplate(
          {
            background:
              backGroundColor ||
              (isLight
                ? colors2024['neutral-bg-0']
                : colors2024['neutral-bg-1']),
            text: colors2024['neutral-title-1'],
            border: colors2024['neutral-bg-5'],
            greenLineColor: 'rgba(42, 187, 127, 1)',
            redLineColor: 'rgba(227, 73, 53, 1)',
            highPriceLineColor: colors2024['neutral-body'],
            lowPriceLineColor: colors2024['neutral-body'],
            tooltip: {
              bg: isLight
                ? colors2024['neutral-bg-1']
                : colors2024['neutral-bg-2'],
              title: colors2024['neutral-body'],
              value: colors2024['neutral-title-1'],
            },
          },
          {
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
          },
        ),
      [backGroundColor, colors2024, isLight, t],
    );

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
        <WebView
          ref={webViewRef}
          style={styles.webView}
          {...(IS_IOS && { allowFileAccess: true })}
          source={{ html: htmlContent, baseUrl: WEBVIEW_BASEURL }}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          {...(Platform.OS === 'ios' ? iosWebViewProps : androidWebViewProps)}
        />
      </View>
    );
  },
);

const getStyle = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
}));

export default TradingViewCandleChart;
