import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';

import type { PerpsProMarket } from '../../model/market';
import type { PerpsPositionViewModel } from '../../model/position';

const mockModalProps = jest.fn();
const mockClearCrosshair = jest.fn();
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockCompleteOlderCandlesRequest = jest.fn();
const mockSetData = jest.fn();
const mockResetPerpsProViewport = jest.fn();
const mockSetPerpsProOverlays = jest.fn();
const mockTradingViewProps = jest.fn();
const mockUpdateCandleData = jest.fn();
const mockToolbarProps = jest.fn();
const mockUsePerpsProKline = jest.fn();

let mockKlineState: Record<string, unknown>;
let mockLastDataDelivery: { identity: string; revision: number } | null;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 0 }),
}));

jest.mock(
  '@/assets2024/icons/perps/PerpsProKline/close.svg',
  () => require('react-native').View,
);

jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/reset.svg',
  () => require('react-native').View,
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
          onPerpsProViewportChange?: (resetVisible: boolean) => void;
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
          resetPerpsProViewport: mockResetPerpsProViewport,
          setData: (data: { identity: string; revision: number }) => {
            mockSetData(data);
            mockLastDataDelivery = {
              identity: data.identity,
              revision: data.revision,
            };
          },
          setPerpsProOverlays: mockSetPerpsProOverlays,
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

const { PERPS_PRO_KLINE_HEADER_HEIGHT, PerpsProKlineSheet: Sheet } =
  require('./PerpsProKlineSheet') as typeof import('./PerpsProKlineSheet');
const { PERPS_PRO_KLINE_CHART_HEIGHT } =
  require('./PerpsProKlineSkeleton') as typeof import('./PerpsProKlineSkeleton');

const PerpsProKlineSheet = (
  props: Omit<React.ComponentProps<typeof Sheet>, 'position'> & {
    position?: PerpsPositionViewModel | null;
  },
) => <Sheet position={null} {...props} />;

const renderHeader = () =>
  render(mockModalProps.mock.calls.at(-1)?.[0].handleComponent());

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

  it('docks without a backdrop and closes from its header or a pan', () => {
    const onClose = jest.fn();
    render(<PerpsProKlineSheet enabled market={market} onClose={onClose} />);

    const props = mockModalProps.mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({
      animateOnMount: false,
      enableContentPanningGesture: false,
      enableHandlePanningGesture: true,
      enablePanDownToClose: true,
      failOffsetX: [-8, 8],
      index: 0,
      keyboardBehavior: 'extend',
      // Header 58 + chart 228 + max(16, safe-area bottom 34).
      snapPoints: [320],
    });
    expect(props.backdropComponent).toBeUndefined();
    expect(props.backgroundStyle).toMatchObject({
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      boxShadow: '0px -4px 16px 0px rgba(0, 0, 0, 0.1)',
    });
    expect(PERPS_PRO_KLINE_HEADER_HEIGHT).toBe(58);
    expect(mockTradingViewProps.mock.calls.at(-1)?.[0]).toMatchObject({
      backGroundColor: 'neutral-bg-1',
      height: PERPS_PRO_KLINE_CHART_HEIGHT,
      variant: 'perps-pro',
    });

    renderHeader();
    fireEvent.press(screen.getByTestId('perps-pro-kline-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => props.onChange(-1));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows reset only after a viewport change and hides it per market', () => {
    const view = render(
      <PerpsProKlineSheet enabled market={market} onClose={jest.fn()} />,
    );
    expect(screen.queryByTestId('perps-pro-kline-reset')).toBeNull();

    act(() =>
      mockTradingViewProps.mock.calls
        .at(-1)?.[0]
        .onPerpsProViewportChange(true),
    );
    fireEvent.press(screen.getByTestId('perps-pro-kline-reset'));
    expect(mockResetPerpsProViewport).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProKlineSheet
        enabled
        market={{
          ...market,
          canonicalCoin: 'ETH',
          displayBase: 'ETH',
          marketKey: 'hyperliquid::ETH',
        }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('perps-pro-kline-reset')).toBeNull();
  });

  it('sends position guides once the chart is ready', () => {
    const position = {
      baseSize: '2',
      entryPrice: '100',
      liquidationPrice: '80',
      tpslOrders: [
        {
          kind: 'takeProfit',
          remainingSize: '0',
          scope: 'position',
          triggerPrice: '120',
        },
        {
          kind: 'stopLoss',
          remainingSize: '0.5',
          scope: 'partial',
          triggerPrice: '90',
        },
      ],
    } as unknown as PerpsPositionViewModel;
    render(
      <PerpsProKlineSheet
        enabled
        market={market}
        onClose={jest.fn()}
        position={position}
      />,
    );
    expect(mockSetPerpsProOverlays).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('trading-view-chart'));
    expect(mockSetPerpsProOverlays.mock.calls.at(-1)?.[0].lines).toEqual([
      {
        id: 'entry',
        kind: 'entry',
        price: 100,
        title: 'page.perpsDetail.simpleChart.averageEntry',
      },
      {
        id: 'liquidation',
        kind: 'liquidation',
        price: 80,
        title: 'page.perpsDetail.simpleChart.liquidation',
      },
      {
        id: 'tp:120',
        kind: 'tp',
        price: 120,
        title: 'page.perpsDetail.simpleChart.takeProfit 100%',
      },
      {
        id: 'sl:90',
        kind: 'sl',
        price: 90,
        title: 'page.perpsDetail.simpleChart.stopLoss 25%',
      },
    ]);
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
