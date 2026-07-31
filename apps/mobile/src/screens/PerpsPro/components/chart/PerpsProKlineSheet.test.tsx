import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import type { PerpsProMarket } from '../../model/market';

const mockModalProps = jest.fn();
const mockPresent = jest.fn();
const mockClearCrosshair = jest.fn();
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockSetData = jest.fn();
const mockUpdateCandleData = jest.fn();
const mockToolbarProps = jest.fn();
const mockUsePerpsProKline = jest.fn();

let mockKlineState: Record<string, unknown>;

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: mockPresent,
        }));
        mockModalProps(props);
        return ReactModule.createElement(
          View,
          { testID: 'bottom-sheet' },
          props.children,
        );
      },
    ),
  };
});

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({ testSharedBottomSheetProp: true }),
}));

jest.mock('@/components2024/TradingViewCandleChart', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (props: Record<string, () => void>, ref: React.Ref<unknown>) => {
        ReactModule.useEffect(() => {
          mockChartMount();
          return mockChartUnmount;
        }, []);
        ReactModule.useImperativeHandle(ref, () => ({
          clearCrosshair: mockClearCrosshair,
          setData: mockSetData,
          updateCandleData: mockUpdateCandleData,
          updateTPSLPriceLines: jest.fn(),
        }));
        return ReactModule.createElement(Pressable, {
          onLongPress: props.onChartError,
          onPress: props.onChartReady,
          testID: 'trading-view-chart',
        });
      },
    ),
  };
});

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
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    BottomSheetView: (props: Record<string, unknown>) =>
      ReactModule.createElement(
        View,
        { style: props.style, testID: 'bottom-sheet-content' },
        props.children,
      ),
  };
});

jest.mock('../../scene/usePerpsProKline', () => ({
  usePerpsProKline: mockUsePerpsProKline,
}));

jest.mock('./PerpsProKlineSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PERPS_PRO_KLINE_CHART_HEIGHT: 184,
    PerpsProKlineSkeleton: ({ overlay }: { overlay?: boolean }) =>
      ReactModule.createElement(View, {
        testID: overlay ? 'kline-overlay-skeleton' : 'kline-skeleton',
      }),
  };
});

jest.mock('./PerpsProKlineToolbar', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProKlineToolbar: (props: Record<string, unknown>) => {
      mockToolbarProps(props);
      return ReactModule.createElement(View, { testID: 'kline-toolbar' });
    },
  };
});

const { PERPS_PRO_KLINE_SHEET_HEIGHT, PerpsProKlineSheet } =
  require('./PerpsProKlineSheet') as typeof import('./PerpsProKlineSheet');

const market = {
  canonicalCoin: 'BTC',
  displayBase: 'BTC',
  marketKey: 'hyperliquid::BTC',
  marketData: {
    pxDecimals: 0,
  },
  quoteAsset: 'USDC',
} as unknown as PerpsProMarket;

const createKlineState = (
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'stale' | 'error',
) => ({
  feed: {
    candles: [],
    error: status === 'error' ? new Error('offline') : null,
    identity: 'BTC:15m',
    latestCandle: null,
    status,
    updateType: 'reset',
  },
  hydrated: true,
  interval: '15m',
  selectInterval: jest.fn(),
});

describe('PerpsProKlineSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKlineState = createKlineState('loading');
    mockUsePerpsProKline.mockImplementation(() => mockKlineState);
  });

  it('uses the approved local sheet geometry and gesture boundary', () => {
    const onClose = jest.fn();
    render(<PerpsProKlineSheet enabled market={market} onClose={onClose} />);

    expect(mockPresent).toHaveBeenCalledTimes(1);
    const props = mockModalProps.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({
      backdropProps: { pressBehavior: 'close' },
      enableContentPanningGesture: false,
      enableDynamicSizing: false,
      enableHandlePanningGesture: true,
      enablePanDownToClose: true,
      snapPoints: [PERPS_PRO_KLINE_SHEET_HEIGHT],
      testSharedBottomSheetProp: true,
    });
    expect(props.style).toMatchObject({
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    });
    expect(props.handleStyle).toMatchObject({
      height: 40,
      paddingBottom: 19,
      paddingTop: 17,
    });
    expect(props.handleIndicatorStyle).toMatchObject({
      height: 4,
      width: 40,
    });

    act(() => props.onDismiss());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['idle', 'loading', 'empty', 'stale', 'error'] as const)(
    'shows the same skeleton for %s',
    status => {
      mockKlineState = createKlineState(status);
      render(
        <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
      );

      expect(screen.getByTestId('kline-overlay-skeleton')).toBeTruthy();
      expect(screen.getByTestId('trading-view-chart')).toBeTruthy();
    },
  );

  it('sends a full snapshot after ready and incremental realtime candles later', async () => {
    mockKlineState = {
      ...createKlineState('ready'),
      feed: {
        candles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            quoteTurnover: null,
            time: 1_800_000,
            trades: 2,
            volume: 3,
          },
        ],
        error: null,
        identity: 'BTC:15m',
        latestCandle: null,
        status: 'ready',
        updateType: 'snapshot',
      },
    };
    const view = render(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId('kline-overlay-skeleton')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trading-view-chart'));

    await waitFor(() => expect(mockSetData).toHaveBeenCalledTimes(1));
    expect(mockSetData).toHaveBeenCalledWith({
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
      fitContent: false,
      interval: '15m',
      noTime: false,
      proConfig: {
        baseAsset: 'BTC',
        initialVisibleBars: 40,
        interval: '15m',
        maPeriods: [7, 25, 99],
        priceDecimals: 0,
        quoteAsset: 'USDC',
        variant: 'perps-pro',
      },
      showVolume: true,
    });

    mockKlineState = {
      ...mockKlineState,
      feed: {
        ...(mockKlineState.feed as object),
        candles: [
          {
            close: 15,
            high: 15,
            low: 9,
            open: 10,
            quoteTurnover: null,
            time: 1_800_000,
            trades: 3,
            volume: 4,
          },
        ],
        latestCandle: null,
        updateType: 'realtime',
      },
    };
    view.rerender(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );

    await waitFor(() =>
      expect(mockUpdateCandleData).toHaveBeenCalledWith({
        close: 15,
        high: 15,
        low: 9,
        open: 10,
        quoteTurnover: null,
        time: 1800,
        trades: 3,
        volume: 4,
      }),
    );
    expect(mockSetData).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('trading-view-chart'));
    await waitFor(() => expect(mockSetData).toHaveBeenCalledTimes(2));
  });

  it('keeps the displayed interval while the next interval loads, then swaps atomically', async () => {
    mockKlineState = {
      ...createKlineState('ready'),
      feed: {
        candles: [
          {
            close: 12,
            high: 13,
            low: 9,
            open: 10,
            quoteTurnover: null,
            time: 1_800_000,
            trades: 2,
            volume: 3,
          },
        ],
        error: null,
        identity: 'BTC:15m',
        latestCandle: null,
        status: 'ready',
        updateType: 'snapshot',
      },
    };
    const view = render(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('trading-view-chart'));
    await waitFor(() => expect(mockSetData).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('kline-overlay-skeleton')).toBeNull();

    mockKlineState = {
      ...createKlineState('loading'),
      feed: {
        ...createKlineState('loading').feed,
        identity: 'BTC:1h',
      },
      interval: '1h',
    };
    view.rerender(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );

    await waitFor(() => expect(mockClearCrosshair).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('kline-overlay-skeleton')).toBeNull();
    expect(mockSetData).toHaveBeenCalledTimes(1);
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartUnmount).not.toHaveBeenCalled();

    mockKlineState = {
      ...mockKlineState,
      feed: {
        candles: [
          {
            close: 22,
            high: 23,
            low: 19,
            open: 20,
            quoteTurnover: null,
            time: 3_600_000,
            trades: 4,
            volume: 5,
          },
        ],
        error: null,
        identity: 'BTC:1h',
        latestCandle: null,
        status: 'ready',
        updateType: 'snapshot',
      },
    };
    view.rerender(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );

    await waitFor(() => expect(mockSetData).toHaveBeenCalledTimes(2));
    expect(mockSetData.mock.calls.at(-1)?.[0]).toMatchObject({
      candles: [{ close: 22, time: 3600 }],
      interval: '1h',
      proConfig: { interval: '1h' },
    });
    expect(screen.queryByTestId('kline-overlay-skeleton')).toBeNull();

    mockKlineState = {
      ...mockKlineState,
      feed: {
        ...createKlineState('stale').feed,
        identity: 'BTC:1h',
      },
    };
    view.rerender(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );
    expect(screen.getByTestId('kline-overlay-skeleton')).toBeTruthy();
  });
});
