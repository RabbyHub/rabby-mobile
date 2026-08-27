import { act, render } from '@testing-library/react-native';
import React from 'react';

import type { TradingViewChartRef } from './index';
import { CandlePeriod } from './type';

const mockLocalWebViewProps = jest.fn();
const mockSendMessage = jest.fn();
const mockReload = jest.fn();
const mockDataApplied = jest.fn();
let mockIsLight = false;

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components/WebView/LocalWebView/LocalWebView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    LocalWebView: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          reload: mockReload,
          sendMessage: mockSendMessage,
        }));
        mockLocalWebViewProps(props);
        return ReactModule.createElement(View, {
          testID: 'local-webview',
        });
      },
    ),
  };
});

jest.mock('@/core/utils/linking', () => ({
  openExternalUrl: jest.fn(),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const { ThemeColors2024 } = require('@rabby-wallet/base-utils');
    const colors2024 = ThemeColors2024[mockIsLight ? 'light' : 'dark'];
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const TradingViewCandleChart = require('./index')
  .default as typeof import('./index').default;

const markChartReady = ({
  perpsProKlineProtocolVersion = 1,
  supportsDataAppliedAck = true,
}: {
  perpsProKlineProtocolVersion?: number | null;
  supportsDataAppliedAck?: boolean;
} = {}) => {
  const props = mockLocalWebViewProps.mock.calls.at(-1)?.[0];
  act(() => {
    props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: 'CHART_READY',
          capabilities: {
            ...(supportsDataAppliedAck ? { candleDataAppliedAck: true } : {}),
            ...(perpsProKlineProtocolVersion == null
              ? {}
              : { perpsProKlineProtocolVersion }),
          },
        }),
      },
    });
  });
};

const getLastSetDataMessage = () =>
  mockSendMessage.mock.calls
    .map(call => call[0])
    .filter(message => message.data?.type === 'SET_CANDLESTICK_DATA')
    .at(-1);

const getLastThemeMessage = () =>
  mockSendMessage.mock.calls
    .map(call => call[0])
    .filter(message => message.data?.type === 'UPDATE_THEME')
    .at(-1);

describe('TradingViewCandleChart protocol compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLight = false;
  });

  it('sends the approved dark Pro crosshair label colors', () => {
    render(<TradingViewCandleChart height={184} variant="perps-pro" />);
    markChartReady();

    expect(getLastThemeMessage().data.colors.crosshairLabel).toEqual({
      background: 'rgba(211, 216, 224, 1)',
      text: 'rgba(0, 0, 0, 1)',
    });
  });

  it('keeps the approved light Pro crosshair label colors', () => {
    mockIsLight = true;
    render(<TradingViewCandleChart height={184} variant="perps-pro" />);
    markChartReady();

    expect(getLastThemeMessage().data.colors.crosshairLabel).toEqual({
      background: 'rgba(0, 0, 0, 1)',
      text: 'rgba(255, 255, 255, 1)',
    });
  });

  it('does not change legacy dark crosshair label colors', () => {
    render(<TradingViewCandleChart height={184} />);
    markChartReady({ perpsProKlineProtocolVersion: null });

    expect(getLastThemeMessage().data.colors.crosshairLabel).toEqual({
      background: 'rgba(0, 0, 0, 1)',
      text: 'rgba(255, 255, 255, 1)',
    });
  });

  it('keeps legacy charts compatible with resources that do not declare the Pro protocol', () => {
    const onChartReady = jest.fn();
    render(<TradingViewCandleChart height={184} onChartReady={onChartReady} />);

    markChartReady({ perpsProKlineProtocolVersion: null });

    expect(onChartReady).toHaveBeenCalledTimes(1);
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('applies an explicit Pro chart background to the native WebView surface', () => {
    render(
      <TradingViewCandleChart
        backGroundColor="#101215"
        height={184}
        variant="perps-pro"
      />,
    );

    expect(mockLocalWebViewProps.mock.calls.at(-1)?.[0]).toMatchObject({
      backGroundColor: '#101215',
      style: { backgroundColor: '#101215' },
    });
  });

  it('does not change the native WebView surface for legacy chart callers', () => {
    render(<TradingViewCandleChart backGroundColor="#101215" height={184} />);

    expect(mockLocalWebViewProps.mock.calls.at(-1)?.[0]).toMatchObject({
      backGroundColor: '#101215',
    });
    expect(mockLocalWebViewProps.mock.calls.at(-1)?.[0].style).toBeUndefined();
  });

  it('reloads once and then rejects a stale resource for Perps Pro', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const onChartError = jest.fn();
    const onChartReady = jest.fn();
    render(
      <TradingViewCandleChart
        height={184}
        onChartError={onChartError}
        onChartReady={onChartReady}
        variant="perps-pro"
      />,
    );

    markChartReady({ perpsProKlineProtocolVersion: null });
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(onChartReady).not.toHaveBeenCalled();
    expect(onChartError).not.toHaveBeenCalled();

    markChartReady({ perpsProKlineProtocolVersion: null });
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(onChartReady).not.toHaveBeenCalled();
    expect(onChartError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      'TradingViewChart: Perps Pro K-line protocol mismatch',
      { actualVersion: null, requiredVersion: 1 },
    );
    consoleError.mockRestore();
  });

  it('keeps the legacy payload free of Pro configuration and Pro-only candle fields', () => {
    const chartRef = React.createRef<TradingViewChartRef>();
    render(<TradingViewCandleChart ref={chartRef} height={184} />);
    markChartReady();

    act(() => {
      chartRef.current?.setData({
        candles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            time: 1800,
            volume: 3,
          },
        ],
        coin: 'BTC',
        interval: CandlePeriod.FIFTEEN_MINUTES,
      });
    });

    const message = getLastSetDataMessage();
    expect(message.data).not.toHaveProperty('proConfig');
    expect(message.data.data[0]).toEqual({
      close: 12,
      high: 13,
      low: 9,
      open: 10,
      time: 1800,
      volume: 3,
    });
  });

  it('forwards explicit Pro configuration and nullable exact-turnover fields', () => {
    const chartRef = React.createRef<TradingViewChartRef>();
    render(
      <TradingViewCandleChart
        ref={chartRef}
        height={184}
        variant="perps-pro"
      />,
    );
    markChartReady();
    const proConfig = {
      baseAsset: 'BTC',
      initialVisibleBars: 40,
      interval: '15m' as const,
      maPeriods: [7, 25, 99] as const,
      priceDecimals: 0,
      quoteAsset: 'USDC',
      variant: 'perps-pro' as const,
    };

    act(() => {
      chartRef.current?.setData({
        candles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            quoteTurnover: null,
            time: 1800,
            trades: 2,
            volume: 3,
          },
        ],
        coin: 'BTC',
        interval: '15m',
        proConfig,
        showVolume: true,
      });
    });

    const message = getLastSetDataMessage();
    expect(message.data.proConfig).toEqual(proConfig);
    expect(message.data.data[0]).toMatchObject({
      quoteTurnover: null,
      trades: 2,
    });
  });

  it('adds optional delivery identity and forwards only valid applied acknowledgements', () => {
    const chartRef = React.createRef<TradingViewChartRef>();
    render(
      <TradingViewCandleChart
        ref={chartRef}
        height={184}
        onDataApplied={mockDataApplied}
        variant="perps-pro"
      />,
    );
    markChartReady();

    act(() => {
      chartRef.current?.setData({
        candles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            time: 1800,
          },
        ],
        coin: 'BTC',
        identity: 'BTC:15m',
        interval: '15m',
        revision: 7,
      });
    });

    expect(getLastSetDataMessage().data).toMatchObject({
      identity: 'BTC:15m',
      revision: 7,
    });
    expect(mockDataApplied).not.toHaveBeenCalled();
    const props = mockLocalWebViewProps.mock.calls.at(-1)?.[0];
    act(() => {
      props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'CANDLE_DATA_APPLIED',
            identity: 'BTC:15m',
            revision: 7,
          }),
        },
      });
      props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'CANDLE_DATA_APPLIED',
            identity: 'BTC:15m',
            revision: 'invalid',
          }),
        },
      });
    });

    expect(mockDataApplied).toHaveBeenCalledTimes(1);
    expect(mockDataApplied).toHaveBeenCalledWith({
      identity: 'BTC:15m',
      revision: 7,
    });
  });

  it('bridges history requests and completion without affecting legacy payloads', () => {
    const onRequestOlderCandles = jest.fn();
    const chartRef = React.createRef<TradingViewChartRef>();
    render(
      <TradingViewCandleChart
        ref={chartRef}
        height={184}
        onRequestOlderCandles={onRequestOlderCandles}
        variant="perps-pro"
      />,
    );
    markChartReady();
    const props = mockLocalWebViewProps.mock.calls.at(-1)?.[0];

    act(() => {
      props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'REQUEST_OLDER_CANDLES',
            earliestTime: 1800,
            identity: 'BTC:15m',
          }),
        },
      });
      chartRef.current?.completeOlderCandlesRequest({
        earliestTime: 1800,
        identity: 'BTC:15m',
        outcome: 'exhausted',
      });
    });

    expect(onRequestOlderCandles).toHaveBeenCalledWith({
      earliestTime: 1800,
      identity: 'BTC:15m',
    });
    expect(mockSendMessage).toHaveBeenLastCalledWith({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'COMPLETE_OLDER_CANDLES_REQUEST',
        earliestTime: 1800,
        identity: 'BTC:15m',
        outcome: 'exhausted',
      },
    });
  });

  it('falls back after dispatch when a legacy page does not declare applied acknowledgements', () => {
    let applyFrame: Parameters<typeof requestAnimationFrame>[0] | undefined;
    const requestFrameSpy = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => {
        applyFrame = callback;
        return 1;
      });
    const chartRef = React.createRef<TradingViewChartRef>();
    render(
      <TradingViewCandleChart
        ref={chartRef}
        height={184}
        onDataApplied={mockDataApplied}
        variant="perps-pro"
      />,
    );
    markChartReady({ supportsDataAppliedAck: false });

    act(() => {
      chartRef.current?.setData({
        candles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            time: 1800,
          },
        ],
        coin: 'BTC',
        identity: 'BTC:15m',
        interval: '15m',
        revision: 8,
      });
    });

    expect(mockDataApplied).not.toHaveBeenCalled();
    act(() => {
      applyFrame?.(0);
    });
    expect(mockDataApplied).toHaveBeenCalledWith({
      identity: 'BTC:15m',
      revision: 8,
    });
    requestFrameSpy.mockRestore();
  });

  it('sends the additive clear-crosshair command only after the chart is ready', () => {
    const chartRef = React.createRef<TradingViewChartRef>();
    render(
      <TradingViewCandleChart
        ref={chartRef}
        height={184}
        variant="perps-pro"
      />,
    );

    act(() => {
      chartRef.current?.clearCrosshair();
    });
    expect(
      mockSendMessage.mock.calls.some(
        call => call[0].data?.type === 'CLEAR_CROSSHAIR',
      ),
    ).toBe(false);

    markChartReady();
    act(() => {
      chartRef.current?.clearCrosshair();
    });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'CLEAR_CROSSHAIR',
      },
    });
  });

  it('does not expose the retired Perps Pro reference-price bridge', () => {
    const chartRef = React.createRef<TradingViewChartRef>();
    render(
      <TradingViewCandleChart
        ref={chartRef}
        height={184}
        variant="perps-pro"
      />,
    );

    expect(chartRef.current).not.toHaveProperty('updatePerpsProReferencePrice');
  });
});
