import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

const mockUsePerpsProScene = jest.fn();
const mockUsePerpsProInfoPanel = jest.fn();
const mockMarketSelectorPresent = jest.fn();
const mockOrderBookRender = jest.fn();
const mockConfirmCancelAll = jest.fn();
const mockConfirmCancelOrder = jest.fn();
const mockKlineProps = jest.fn();

jest.mock('@/hooks/perps/subscriptions/useActiveAssetSubscription', () => ({
  useActiveAssetSubscription: () => ({
    activeAssetData: null,
    refreshActiveAssetData: jest.fn(async () => null),
  }),
}));

jest.mock('@/assets2024/icons/perps/IconHistoryCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
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

jest.mock('../components/account/PerpsProAccountSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProAccountSkeleton: () =>
      ReactModule.createElement(View, { testID: 'account-skeleton' }),
  };
});

jest.mock('../components/account/PerpsProFundingOverlay', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProFundingOverlay: () =>
      ReactModule.createElement(View, { testID: 'funding-overlay' }),
  };
});

jest.mock('../components/positions/PerpsProPositionCard', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProPositionCard: () =>
      ReactModule.createElement(View, { testID: 'position-card' }),
  };
});

jest.mock('../components/positions/PerpsProLeverageSheet', () => ({
  PerpsProLeverageSheet: () => null,
}));

jest.mock('../components/positions/PerpsProClosePositionSheet', () => ({
  PerpsProClosePositionSheet: () => null,
}));

jest.mock('../components/positions/PerpsProCloseConfirmationSheet', () => ({
  PerpsProCloseConfirmationSheet: () => null,
}));

jest.mock('../components/open-orders/PerpsProCancelConfirmationModal', () => ({
  PerpsProCancelConfirmationModal: () => null,
}));

jest.mock('../components/open-orders/PerpsProOpenOrderCard', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProOpenOrderCard: () =>
      ReactModule.createElement(View, { testID: 'open-order-card' }),
  };
});

jest.mock('../components/chart/PerpsProKlineSheet', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsProKlineSheet: (props: {
      enabled: boolean;
      onClose: () => void;
      preloadEnabled: boolean;
      visible: boolean;
    }) => {
      mockKlineProps(props);
      return ReactModule.createElement(Pressable, {
        onPress: props.onClose,
        testID: 'kline-sheet',
      });
    },
  };
});

jest.mock('../components/common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('../components/header/PerpsProHeader', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHeader: () =>
      ReactModule.createElement(View, { testID: 'pro-header' }),
  };
});

jest.mock('../components/header/PerpsProAccountSelectorLayer', () => ({
  PerpsProAccountSelectorLayer: () => null,
}));

jest.mock('../components/header/usePerpsProHeaderCollapse', () => ({
  usePerpsProHeaderCollapse: () => ({
    headerOpacity: 1,
    headerTranslateY: 0,
    marketTranslateY: 56,
    onScroll: jest.fn(),
  }),
}));

jest.mock('../components/loading/PerpsProSceneSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketBarSkeleton: () =>
      ReactModule.createElement(View, { testID: 'market-bar-skeleton' }),
    PerpsProSceneSkeleton: () =>
      ReactModule.createElement(View, { testID: 'scene-skeleton' }),
  };
});

jest.mock('../components/market/PerpsProMarketBar', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PERPS_PRO_MARKET_BAR_HEIGHT: 40,
    PerpsProMarketBar: ({
      onOpenKline,
      onPress,
    }: {
      onOpenKline: () => void;
      onPress: () => void;
    }) =>
      ReactModule.createElement(
        ReactModule.Fragment,
        null,
        ReactModule.createElement(Pressable, {
          onPress,
          testID: 'market-bar',
        }),
        ReactModule.createElement(Pressable, {
          onPress: onOpenKline,
          testID: 'kline-trigger',
        }),
      ),
  };
});

jest.mock('../components/market/PerpsProMarketSelector', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketSelector: ReactModule.forwardRef(
      (_props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: mockMarketSelectorPresent,
        }));
        return ReactModule.createElement(View, { testID: 'market-selector' });
      },
    ),
  };
});

jest.mock('../components/trade/PerpsProTradeForm', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProTradeForm: () =>
      ReactModule.createElement(View, { testID: 'trade-form' }),
  };
});

jest.mock('../components/trade/PerpsProOrderConfirmationSheet', () => ({
  PerpsProOrderConfirmationSheet: () => null,
}));

jest.mock('./PerpsProRealtimeOrderBook', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProRealtimeOrderBook: () => {
      mockOrderBookRender();
      return ReactModule.createElement(View, {
        testID: 'realtime-order-book',
      });
    },
  };
});

jest.mock('./usePerpsProScene', () => ({
  usePerpsProScene: mockUsePerpsProScene,
}));

jest.mock('./usePerpsProBboBook', () => ({
  usePerpsProBboBook: () => ({
    book: null,
    prices: { asks1: null, asks5: null, bids1: null, bids5: null },
    sessionKey: null,
    status: 'loading',
  }),
}));

jest.mock('./usePerpsProTrade', () => ({
  usePerpsProTrade: ({ market }: { market: unknown }) => ({
    amountUnit: 'quote',
    closeReview: jest.fn(),
    confirmReview: jest.fn(),
    form: { bboEnabled: false, orderType: 'market' },
    leverage: 1,
    marginMode: 'isolated',
    market,
    pending: false,
    review: null,
    setPrice: jest.fn(),
    setSkipConfirmation: jest.fn(),
    skipConfirmation: false,
  }),
}));

jest.mock('./usePerpsProLeverageUpdate', () => ({
  usePerpsProLeverageUpdate: () => ({
    pending: false,
    update: jest.fn(async () => true),
  }),
}));

jest.mock('./usePerpsProZeroAddressLeverageBaseline', () => ({
  usePerpsProZeroAddressLeverageBaseline: () => null,
}));

jest.mock('./usePerpsProInfoPanel', () => ({
  usePerpsProInfoPanel: mockUsePerpsProInfoPanel,
}));

jest.mock('./usePerpsProCancelOrders', () => ({
  usePerpsProCancelOrders: () => ({
    confirmation: null,
    confirmCancellation: jest.fn(),
    confirmCancelAll: mockConfirmCancelAll,
    confirmCancelOrder: mockConfirmCancelOrder,
    dismissConfirmation: jest.fn(),
    isCancelAllPending: false,
    isOrderPending: () => false,
  }),
}));

jest.mock('./usePerpsProPositionActions', () => ({
  usePerpsProPositionActions: () => ({
    cancelCloseReview: jest.fn(),
    closeCloseEditor: jest.fn(),
    closeEditor: null,
    closePending: false,
    closeReview: null,
    closeLeverageEditor: jest.fn(),
    confirmClose: jest.fn(),
    leverageEditor: null,
    leveragePending: false,
    openCloseEditor: jest.fn(),
    openLeverageEditor: jest.fn(),
    reviewClose: jest.fn(),
    setSkipLimitConfirmation: jest.fn(),
    skipLimitConfirmation: false,
    updateLeverage: jest.fn(),
  }),
}));

const { PerpsProScene } =
  require('./PerpsProScene') as typeof import('./PerpsProScene');

const createSceneState = (overrides: Record<string, unknown> = {}) => ({
  currentMarket: null,
  isResolvingMarket: false,
  klineEnabled: false,
  marketDataStatus: 'success',
  precision: null,
  realtimeEnabled: false,
  retryMarketData: jest.fn(),
  selectMarket: jest.fn(),
  selectTickOption: jest.fn(),
  selectedTickOption: null,
  tickOptions: [],
  ...overrides,
});

const createInfoState = (overrides: Record<string, unknown> = {}) => ({
  account: { assets: [] },
  accountIdentity: 'test-account',
  accountState: 'loading',
  activeInfoTab: 'account',
  allOpenOrdersCount: 0,
  allPositionsCount: 0,
  hideOtherSymbols: false,
  openOrderCategory: 'basic',
  openOrderCommandCandidates: [],
  openOrderCounts: { basic: 0, conditional: 0, unsupported: 0 },
  openOrders: [],
  positions: [],
  retryAccount: jest.fn(),
  setActiveInfoTab: jest.fn(),
  setHideOtherSymbols: jest.fn(),
  setOpenOrderCategory: jest.fn(),
  ...overrides,
});

describe('PerpsProScene market loading states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    mockUsePerpsProInfoPanel.mockReturnValue(createInfoState());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the full skeleton while a ready catalogue resolves its market', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        isResolvingMarket: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('market-bar-skeleton')).toBeTruthy();
    expect(screen.getByTestId('scene-skeleton')).toBeTruthy();
    expect(screen.queryByText('page.perps.pro.common.unavailable')).toBeNull();
  });

  it('keeps one fixed scroll owner and reserves stable overlay lead-in geometry', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const scroll = screen.getByTestId('perps-pro-scroll');
    expect(scroll.props.stickyHeaderIndices).toEqual([]);
    expect(StyleSheet.flatten(scroll.props.style)?.transform).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-scroll-lead-in').props.style,
      ),
    ).toMatchObject({ height: 96 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-overlay').props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        height: 40,
        transform: [{ translateY: 56 }],
      }),
    );
  });

  it('presents the prewarmed selector without rerendering the scene content', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('market-selector')).toBeTruthy();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
    expect(mockMarketSelectorPresent).not.toHaveBeenCalled();
    const orderBookRendersBeforeOpen = mockOrderBookRender.mock.calls.length;

    fireEvent.press(screen.getByTestId('market-bar'));

    expect(mockMarketSelectorPresent).toHaveBeenCalledTimes(1);
    expect(mockOrderBookRender).toHaveBeenCalledTimes(
      orderBookRendersBeforeOpen,
    );
  });

  it('opens the K-line sheet from its dedicated market action', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        klineEnabled: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(screen.getByTestId('kline-sheet')).toBeTruthy();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
  });

  it('prewarms K-line without WS and keeps the same host after close', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        klineEnabled: true,
      }),
    );
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('kline-sheet')).toBeTruthy();
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: false,
      preloadEnabled: true,
      visible: false,
    });

    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      visible: true,
    });

    fireEvent.press(screen.getByTestId('kline-sheet'));
    expect(screen.getByTestId('kline-sheet')).toBeTruthy();
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      visible: false,
    });

    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({ visible: true });
  });

  it('stops the retained Candle Feed while the app is in background', () => {
    let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'change') onAppStateChange = cb;
      return { remove: jest.fn() } as never;
    });
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        klineEnabled: true,
      }),
    );
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('kline-trigger'));

    act(() => onAppStateChange?.('background'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: false,
      preloadEnabled: false,
    });

    act(() => onAppStateChange?.('active'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      preloadEnabled: true,
    });
  });

  it('closes the local funding overlay when the active account changes', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ accountIdentity: 'account-a', accountState: 'empty' }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByText('page.perps.pro.account.deposit'));
    expect(screen.getByTestId('funding-overlay')).toBeTruthy();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ accountIdentity: 'account-b', accountState: 'empty' }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.queryByTestId('funding-overlay')).toBeNull();
  });
});
