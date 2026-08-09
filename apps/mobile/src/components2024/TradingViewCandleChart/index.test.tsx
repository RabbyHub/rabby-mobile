import { act, render } from '@testing-library/react-native';
import React from 'react';

import type { TradingViewChartRef } from './index';
import { CandlePeriod } from './type';

const mockLocalWebViewProps = jest.fn();
const mockSendMessage = jest.fn();
const mockDataApplied = jest.fn();

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
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return {
      colors2024,
      isLight: false,
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
  supportsDataAppliedAck = true,
}: {
  supportsDataAppliedAck?: boolean;
} = {}) => {
  const props = mockLocalWebViewProps.mock.calls.at(-1)?.[0];
  act(() => {
    props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: 'CHART_READY',
          ...(supportsDataAppliedAck
            ? { capabilities: { candleDataAppliedAck: true } }
            : {}),
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

describe('TradingViewCandleChart protocol compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
