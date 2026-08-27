import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import { ThemeColors2024 } from '@/constant/theme';

import type { PerpsProMarket } from '../../model/market';

const mockModalProps = jest.fn();
const mockClearCrosshair = jest.fn();
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockCompleteOlderCandlesRequest = jest.fn();
const mockSetData = jest.fn();
const mockResetPriceScale = jest.fn();
const mockTradingViewProps = jest.fn();
const mockUpdateCandleData = jest.fn();
const mockToolbarProps = jest.fn();
const mockUsePerpsProKline = jest.fn();

let mockKlineState: Record<string, unknown>;
let mockLastDataDelivery: { identity: string; revision: number } | null;

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({ testSharedBottomSheetProp: true }),
}));

jest.mock('@/components/Typography', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    Text: (props: Record<string, unknown>) =>
      ReactModule.createElement(Text, props),
  };
});

jest.mock('@/components2024/TradingViewCandleChart', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (
        props: {
          onChartError?: () => void;
          onChartReady?: () => void;
          onDataApplied?: (data: {
            identity: string;
            revision: number;
          }) => void;
          onRequestOlderCandles?: (request: {
            earliestTime: number;
            identity: string;
          }) => Promise<void>;
        },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useEffect(() => {
          mockChartMount();
          return mockChartUnmount;
        }, []);
        mockTradingViewProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          clearCrosshair: mockClearCrosshair,
          completeOlderCandlesRequest: mockCompleteOlderCandlesRequest,
          resetPriceScale: mockResetPriceScale,
          setData: (data: { identity: string; revision: number }) => {
            mockSetData(data);
            mockLastDataDelivery = {
              identity: data.identity,
              revision: data.revision,
            };
          },
          updateCandleData: mockUpdateCandleData,
          updateTPSLPriceLines: jest.fn(),
        }));
        return ReactModule.createElement(Pressable, {
          onLongPress: props.onChartError,
          onPress: props.onChartReady,
          onPressOut: () =>
            mockLastDataDelivery && props.onDataApplied?.(mockLastDataDelivery),
          testID: 'trading-view-chart',
        });
      },
    ),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: (options?: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'neutral-line'
            ? 'rgba(224, 229, 236, 1)'
            : key === 'neutral-sheet-handle'
            ? 'rgba(209, 212, 219, 1)'
            : String(key),
      },
    );
    return {
      colors2024,
      isLight: true,
      styles: options?.getStyle({ colors2024, isLight: true }),
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
    __esModule: true,
    default: ReactModule.forwardRef(
      (props: Record<string, unknown>, _ref: React.Ref<unknown>) => {
        mockModalProps(props);
        return ReactModule.createElement(
          View,
          { testID: 'bottom-sheet' },
          props.children,
        );
      },
    ),
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'bottom-sheet-backdrop',
      }),
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

jest.mock('../loading/PerpsProSkeletonBlock', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProSkeletonBlock: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, props),
  };
});

jest.mock('./PerpsProKlineSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const actual = jest.requireActual(
    './PerpsProKlineSkeleton',
  ) as typeof import('./PerpsProKlineSkeleton');
  return {
    ...actual,
    PerpsProKlineSkeleton: ({ overlay }: { overlay?: boolean }) =>
      ReactModule.createElement(View, {
        testID: overlay ? 'kline-overlay-skeleton' : 'kline-skeleton',
      }),
  };
});

jest.mock('./PerpsProKlineToolbar', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const actual = jest.requireActual(
    './PerpsProKlineToolbar',
  ) as typeof import('./PerpsProKlineToolbar');
  return {
    ...actual,
    PerpsProKlineToolbar: (props: Record<string, unknown>) => {
      mockToolbarProps(props);
      return ReactModule.createElement(View, { testID: 'kline-toolbar' });
    },
  };
});

const {
  PERPS_PRO_KLINE_CONTENT_HEIGHT,
  PERPS_PRO_KLINE_FOOTER_HEIGHT,
  PERPS_PRO_KLINE_HANDLE_HEIGHT,
  PERPS_PRO_KLINE_SHEET_HEIGHT,
  PerpsProKlineSheet,
} = require('./PerpsProKlineSheet') as typeof import('./PerpsProKlineSheet');
const { PERPS_PRO_KLINE_CHART_HEIGHT } =
  require('./PerpsProKlineSkeleton') as typeof import('./PerpsProKlineSkeleton');
const { PERPS_PRO_KLINE_TOOLBAR_HEIGHT } =
  require('./PerpsProKlineToolbar') as typeof import('./PerpsProKlineToolbar');

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
  loadOlder: jest.fn().mockResolvedValue('ignored'),
  selectInterval: jest.fn(),
});

describe('PerpsProKlineSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastDataDelivery = null;
    mockKlineState = createKlineState('loading');
    mockUsePerpsProKline.mockImplementation(() => mockKlineState);
  });

  it('uses the approved local sheet geometry and gesture boundary', () => {
    const onClose = jest.fn();
    render(<PerpsProKlineSheet enabled market={market} onClose={onClose} />);

    const props = mockModalProps.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({
      animateOnMount: false,
      enableContentPanningGesture: false,
      enableDynamicSizing: false,
      enableHandlePanningGesture: true,
      enablePanDownToClose: true,
      index: 0,
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
      paddingBottom: 27,
      paddingTop: 9,
    });
    expect(props.handleIndicatorStyle).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-sheet-handle'],
      height: 4,
      width: 40,
    });
    expect({
      chart: PERPS_PRO_KLINE_CHART_HEIGHT,
      content: PERPS_PRO_KLINE_CONTENT_HEIGHT,
      footer: PERPS_PRO_KLINE_FOOTER_HEIGHT,
      handle: PERPS_PRO_KLINE_HANDLE_HEIGHT,
      sheet: PERPS_PRO_KLINE_SHEET_HEIGHT,
      toolbar: PERPS_PRO_KLINE_TOOLBAR_HEIGHT,
    }).toEqual({
      chart: 224,
      content: 286,
      footer: 40,
      handle: 40,
      sheet: 326,
      toolbar: 22,
    });
    expect(
      screen.getByTestId('bottom-sheet-content').props.style,
    ).toMatchObject({
      height: PERPS_PRO_KLINE_CONTENT_HEIGHT,
    });
    expect(
      screen.getByTestId('perps-pro-kline-footer').props.style,
    ).toMatchObject({
      height: PERPS_PRO_KLINE_FOOTER_HEIGHT,
    });
    expect(mockTradingViewProps.mock.calls.at(-1)?.[0]).toMatchObject({
      backGroundColor: 'neutral-bg-1',
      height: PERPS_PRO_KLINE_CHART_HEIGHT,
      variant: 'perps-pro',
    });
    act(() => {
      mockToolbarProps.mock.calls.at(-1)?.[0].onResetPriceScale();
    });
    expect(mockResetPriceScale).toHaveBeenCalledTimes(1);

    const backdrop = props.backdropComponent({});
    expect(backdrop.props).toMatchObject({
      appearsOnIndex: 0,
      disappearsOnIndex: -1,
      pressBehavior: 'close',
    });

    act(() => props.onChange(-1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('loads older candles only for the current visible Pro identity', async () => {
    const loadOlder = jest.fn().mockResolvedValue('exhausted');
    mockKlineState = {
      ...createKlineState('ready'),
      loadOlder,
    };
    render(<PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />);
    const chartProps = mockTradingViewProps.mock.calls.at(-1)?.[0];

    await act(async () => {
      await chartProps.onRequestOlderCandles({
        earliestTime: 1800,
        identity: 'BTC:15m',
      });
    });

    expect(loadOlder).toHaveBeenCalledTimes(1);
    expect(mockCompleteOlderCandlesRequest).toHaveBeenCalledWith({
      earliestTime: 1800,
      identity: 'BTC:15m',
      outcome: 'exhausted',
    });

    await act(async () => {
      await chartProps.onRequestOlderCandles({
        earliestTime: 1800,
        identity: 'ETH:15m',
      });
    });

    expect(loadOlder).toHaveBeenCalledTimes(1);
    expect(mockCompleteOlderCandlesRequest).toHaveBeenLastCalledWith({
      earliestTime: 1800,
      identity: 'ETH:15m',
      outcome: 'retry',
    });
  });

  it('removes the retained sheet from hit testing while it is hidden', () => {
    const view = render(
      <PerpsProKlineSheet
        enabled
        market={market}
        onClose={jest.fn()}
        visible
      />,
    );

    expect(
      screen.getByTestId('perps-pro-kline-retained-host').props.pointerEvents,
    ).toBe('box-none');
    expect(mockClearCrosshair).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProKlineSheet
        enabled={false}
        market={market}
        onClose={jest.fn()}
        visible={false}
      />,
    );

    expect(
      screen.getByTestId('perps-pro-kline-retained-host').props.pointerEvents,
    ).toBe('none');
    expect(mockClearCrosshair).toHaveBeenCalledTimes(1);
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
      identity: 'BTC:15m',
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
      revision: 1,
      showVolume: false,
    });
    expect(screen.getByTestId('kline-overlay-skeleton')).toBeTruthy();
    fireEvent(screen.getByTestId('trading-view-chart'), 'pressOut');
    await waitFor(() =>
      expect(screen.queryByTestId('kline-overlay-skeleton')).toBeNull(),
    );

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
    fireEvent(screen.getByTestId('trading-view-chart'), 'pressOut');
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
    fireEvent(screen.getByTestId('trading-view-chart'), 'pressOut');
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
