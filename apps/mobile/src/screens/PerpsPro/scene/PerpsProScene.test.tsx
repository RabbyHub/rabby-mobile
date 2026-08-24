import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import {
  AppState,
  Dimensions,
  Keyboard,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';

const mockUsePerpsProScene = jest.fn();
const mockUsePerpsProInfoPanel = jest.fn();
const mockMarketSelectorPresent = jest.fn();
const mockOrderBookRender = jest.fn();
const mockOrderBookProps = jest.fn();
const mockTradeFormProps = jest.fn();
const mockFundingOverlayProps = jest.fn();
const mockConfirmCancelAll = jest.fn();
const mockConfirmCancelOrder = jest.fn();
const mockRequestCloseAll = jest.fn();
const mockKlineProps = jest.fn();
const mockUsePerpsProPositionActions = jest.fn();
const mockUsePerpsProPositionTpSl = jest.fn();
const mockUsePerpsProOpenOrderEdit = jest.fn();
const mockClosePositionSheetProps = jest.fn();
const mockCloseConfirmationSheetProps = jest.fn();
const mockSelectOrderBookPrice = jest.fn();
const mockGetOrderBookPriceIntent = jest.fn();
const mockTriggerImpact = jest.fn();
const mockInfoPagerSetPage = jest.fn();
const mockInfoPagerSetPageWithoutAnimation = jest.fn();
let mockTradeHasPermission = true;
let mockTradeFocusedLeg: 'sl' | 'tp' | null = null;
let mockOrderBookPriceIntent:
  | { type: 'attachedTpSlPrice'; leg: 'sl' | 'tp' }
  | { type: 'dismissKeyboard' }
  | { type: 'tradePrice' } = { type: 'tradePrice' };
let mockOrderBookSelectionOutcome: 'accepted' | 'invalidPrice' | 'rejected' =
  'accepted';
let mockTradeForm: {
  bboEnabled: boolean;
  orderType: 'conditional' | 'limit' | 'market';
} = { bboEnabled: false, orderType: 'market' };

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ReactModule.forwardRef(
    (
      { children, ...props }: { children: React.ReactNode },
      ref: React.Ref<unknown>,
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        setPage: mockInfoPagerSetPage,
        setPageWithoutAnimation: mockInfoPagerSetPageWithoutAnimation,
      }));
      return ReactModule.createElement(View, props, children);
    },
  );
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType) => Component,
      ScrollView: ReactNative.ScrollView,
      View: ReactNative.View,
    },
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    scrollTo: jest.fn(),
    useAnimatedRef: () => {
      const ref = (component?: unknown) => {
        ref.current = component ?? null;
        return 0;
      };
      ref.current = null;
      ref.observe = jest.fn(() => jest.fn());
      return ref;
    },
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useEvent:
      (handler: (event: object) => void, eventNames?: string[]) =>
      (event: { nativeEvent?: object }) =>
        handler({
          ...(event.nativeEvent ?? event),
          eventName: eventNames?.[0] ?? 'onPageScroll',
        }),
    useScrollViewOffset: (_ref: unknown, offset: unknown) => offset,
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

jest.mock('@/screens/Perps/components/PerpsRegionAlert', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PERPS_REGION_ALERT_HEADER_SPACING: 8,
    PERPS_REGION_ALERT_HORIZONTAL_MARGIN: 16,
    PerpsRegionAlert: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'perps-region-alert',
      }),
  };
});

jest.mock('@/hooks/perps/subscriptions/useActiveAssetSubscription', () => ({
  useActiveAssetSubscription: () => ({
    activeAssetData: null,
    refreshActiveAssetData: jest.fn(async () => null),
  }),
}));

jest.mock('@/hooks/perps/funding/usePerpsFundingHistoryJournal', () => ({
  usePerpsFundingHistoryJournal: jest.fn(),
}));

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({ setOptions: jest.fn() }),
}));

jest.mock('@/hooks/useAppGesture', () => ({
  useHandleBackPressClosable: jest.fn(),
}));

jest.mock('@/utils/common', () => ({
  triggerImpact: (...args: unknown[]) => mockTriggerImpact(...args),
}));

jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-gesture-handler', () => {
  const gesture: Record<string, jest.Mock> = {};
  gesture.activeOffsetX = jest.fn(() => gesture);
  gesture.failOffsetY = jest.fn(() => gesture);
  gesture.runOnJS = jest.fn(() => gesture);
  gesture.onEnd = jest.fn(() => gesture);
  return {
    Gesture: { Pan: () => gesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('@/assets2024/icons/perps/IconHistoryCC.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/common/checkbox-empty-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/common/checkbox-filled-brand.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/singleHome/empty-token.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/singleHome/empty-token-dark.svg', () => {
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
      isLight: true,
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

jest.mock('../components/account/PerpsProAccountAssetRow', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsProAccountAssetRow: ({
      asset,
      onSwap,
    }: {
      asset: { coin: string; key: string };
      onSwap: (coin: string) => void;
    }) =>
      ReactModule.createElement(Pressable, {
        onPress: () => onSwap(asset.coin),
        testID: `account-asset-${asset.key}`,
      }),
  };
});

jest.mock('../components/account/PerpsProFundingOverlay', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProFundingOverlay: (props: object) => {
      mockFundingOverlayProps(props);
      return ReactModule.createElement(View, { testID: 'funding-overlay' });
    },
  };
});

jest.mock('../components/account/PerpsProTransferSheet', () => ({
  PerpsProTransferSheet: () => null,
}));

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

jest.mock('../components/positions/PerpsProManageMarginSheet', () => ({
  PerpsProManageMarginSheet: () => null,
}));

jest.mock(
  '../components/positions/PerpsProPositionTpSlConfirmationSheet',
  () => ({ PerpsProPositionTpSlConfirmationSheet: () => null }),
);

jest.mock('../components/positions/PerpsProPositionTpSlSheet', () => ({
  PerpsProPositionTpSlSheet: () => null,
}));

jest.mock('../components/positions/PerpsProClosePositionSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProClosePositionSheet: (props: object) => {
      mockClosePositionSheetProps(props);
      return ReactModule.createElement(View, {
        testID: 'close-position-sheet',
      });
    },
  };
});

jest.mock('../components/positions/PerpsProCloseConfirmationSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProCloseConfirmationSheet: (props: object) => {
      mockCloseConfirmationSheetProps(props);
      return ReactModule.createElement(View, {
        testID: 'close-confirmation-sheet',
      });
    },
  };
});

jest.mock('../components/positions/PerpsProCloseAllConfirmationModal', () => ({
  PerpsProCloseAllConfirmationModal: () => null,
}));

jest.mock('../components/open-orders/PerpsProCancelConfirmationModal', () => ({
  PerpsProCancelConfirmationModal: () => null,
}));

jest.mock('../components/open-orders/PerpsProBasicOrderEditSheet', () => ({
  PerpsProBasicOrderEditSheet: () => null,
}));

jest.mock(
  '../components/open-orders/PerpsProConditionalOrderEditSheet',
  () => ({
    PerpsProConditionalOrderEditSheet: () => null,
  }),
);

jest.mock(
  '../components/open-orders/PerpsProOpenOrderEditConfirmationSheet',
  () => ({ PerpsProOpenOrderEditConfirmationSheet: () => null }),
);

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

jest.mock('../components/common/PerpsProFieldExplanationProvider', () => ({
  PerpsProFieldExplanationProvider: ({ children }: { children: unknown }) =>
    children,
}));

jest.mock('../components/header/PerpsProHeader', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHeader: (props: object) =>
      ReactModule.createElement(View, { ...props, testID: 'pro-header' }),
  };
});

jest.mock('../components/header/PerpsProAccountSelectorLayer', () => ({
  PerpsProAccountSelectorLayer: () => null,
}));

jest.mock('../components/header/usePerpsProHeaderCollapse', () => ({
  usePerpsProHeaderCollapse: () => {
    const { Animated } = require('react-native');
    return {
      getScrollOffset: () => 0,
      headerOpacity: 1,
      headerTranslateY: 0,
      marketTranslateY: 56,
      onScroll: jest.fn(),
      scrollY: new Animated.Value(0),
      syncScrollOffset: jest.fn(),
    };
  },
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
    PerpsProTradeForm: (props: object) => {
      mockTradeFormProps(props);
      return ReactModule.createElement(View, { testID: 'trade-form' });
    },
  };
});

jest.mock('../components/trade/PerpsProOrderConfirmationSheet', () => ({
  PerpsProOrderConfirmationSheet: () => null,
}));

jest.mock('./PerpsProRealtimeOrderBook', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProRealtimeOrderBook: (props: object) => {
      mockOrderBookRender();
      mockOrderBookProps(props);
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
    form: mockTradeForm,
    getOrderBookPriceIntent: () => mockGetOrderBookPriceIntent(),
    hasPermission: mockTradeHasPermission,
    leverage: 1,
    marginMode: 'isolated',
    market,
    pending: false,
    review: null,
    selectOrderBookPrice: (...args: unknown[]) =>
      mockSelectOrderBookPrice(...args),
    setPrice: jest.fn(),
    setSkipConfirmation: jest.fn(),
    skipConfirmation: false,
    tpSl: { focusedLeg: mockTradeFocusedLeg },
  }),
}));

jest.mock('./usePerpsProLeverageUpdate', () => ({
  usePerpsProLeverageUpdate: () => ({
    pending: false,
    update: jest.fn(async () => true),
  }),
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

jest.mock('./usePerpsProOpenOrderEdit', () => ({
  usePerpsProOpenOrderEdit: mockUsePerpsProOpenOrderEdit,
}));

jest.mock('./usePerpsProCloseAll', () => ({
  usePerpsProCloseAll: () => ({
    confirmation: null,
    confirmCloseAll: jest.fn(),
    dismissConfirmation: jest.fn(),
    pending: false,
    requestCloseAll: mockRequestCloseAll,
  }),
}));

jest.mock('./usePerpsProPositionActions', () => ({
  usePerpsProPositionActions: mockUsePerpsProPositionActions,
}));

jest.mock('./usePerpsProManageMargin', () => ({
  usePerpsProManageMargin: () => ({
    beginEditing: jest.fn(),
    changeDraft: jest.fn(),
    close: jest.fn(),
    confirm: jest.fn(),
    dirty: false,
    draft: '',
    editor: null,
    open: jest.fn(),
    pending: false,
    selectTarget: jest.fn(),
    view: null,
  }),
}));

jest.mock('./usePerpsProPositionTpSl', () => ({
  usePerpsProPositionTpSl: mockUsePerpsProPositionTpSl,
}));

jest.mock('./usePerpsProTransfer', () => ({
  usePerpsProTransfer: () => ({
    close: jest.fn(),
    confirm: jest.fn(),
    editor: null,
    open: jest.fn(),
    pending: false,
  }),
}));

const { PerpsProScene } =
  require('./PerpsProScene') as typeof import('./PerpsProScene');

const createSceneState = (overrides: Record<string, unknown> = {}) => ({
  accountLeverageConfiguration: null,
  cancelPendingMarketSelection: jest.fn(),
  currentMarket: null,
  executionActive: false,
  isResolvingMarket: false,
  klineEnabled: false,
  marketDataStatus: 'success',
  precision: null,
  prefetchMarket: jest.fn(),
  orderBookSubscriptionEnabled: false,
  realtimeEnabled: false,
  retryMarketData: jest.fn(),
  selectMarket: jest.fn(),
  selectMarketByCoin: jest.fn(async () => true),
  selectTickOption: jest.fn(),
  selectedTickOption: null,
  tickOptions: [],
  tradeConfigurationReady: false,
  zeroAddressLeverageBaseline: null,
  ...overrides,
});

const createInfoState = (overrides: Record<string, unknown> = {}) => ({
  account: { assets: [], mode: 'standard' },
  accountIdentity: 'test-account',
  accountState: 'loading',
  activeInfoTab: 'account',
  allOpenOrdersCount: 0,
  allPositionsCount: 0,
  hideOtherSymbols: false,
  openOrderCategory: 'basic',
  openOrderCommandCandidates: [],
  openOrderCounts: { basic: 0, conditional: 0, unsupported: 0 },
  openOrdersEmpty: false,
  openOrders: [],
  pendingFundingCount: 0,
  positionsEmpty: false,
  positions: [],
  retryAccount: jest.fn(),
  setActiveInfoTab: jest.fn(),
  setHideOtherSymbols: jest.fn(),
  setOpenOrderCategory: jest.fn(),
  ...overrides,
});

const createPositionActionsState = (
  overrides: Record<string, unknown> = {},
) => ({
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
  ...overrides,
});

describe('PerpsProScene market loading states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrderBookPriceIntent.mockImplementation(
      () => mockOrderBookPriceIntent,
    );
    mockSelectOrderBookPrice.mockImplementation(
      () => mockOrderBookSelectionOutcome,
    );
    mockTradeHasPermission = true;
    mockTradeFocusedLeg = null;
    mockOrderBookPriceIntent = { type: 'tradePrice' };
    mockOrderBookSelectionOutcome = 'accepted';
    mockTradeForm = { bboEnabled: false, orderType: 'market' };
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    mockUsePerpsProInfoPanel.mockReturnValue(createInfoState());
    mockUsePerpsProPositionActions.mockReturnValue(
      createPositionActionsState(),
    );
    mockUsePerpsProPositionTpSl.mockReturnValue({
      cancelOrder: jest.fn(),
      cancelingOids: [],
      confirmedCancelledOids: [],
      close: jest.fn(),
      closeReview: jest.fn(),
      confirm: jest.fn(),
      editor: null,
      open: jest.fn(),
      pending: false,
      requestReview: jest.fn(),
      review: null,
    });
    mockUsePerpsProOpenOrderEdit.mockReturnValue({
      close: jest.fn(),
      closeReview: jest.fn(),
      confirm: jest.fn(),
      editor: null,
      open: jest.fn(),
      pending: false,
      requestBasicReview: jest.fn(),
      requestConditionalReview: jest.fn(),
      review: null,
      skipConfirmation: false,
      toggleSkipConfirmation: jest.fn(),
    });
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
    expect(mockUsePerpsProPositionTpSl).toHaveBeenCalledWith(
      'test-account',
      'quote',
    );
  });

  it('renders the order-book and static trade frame before account trade configuration is ready', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        orderBookSubscriptionEnabled: true,
        realtimeEnabled: true,
        tradeConfigurationReady: false,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.queryByTestId('scene-skeleton')).toBeNull();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
    expect(screen.getByTestId('trade-form')).toBeTruthy();
    expect(mockOrderBookProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      publicationEnabled: true,
    });
    expect(mockTradeFormProps.mock.lastCall?.[0]).toMatchObject({
      configurationReady: false,
    });
    expect(mockOrderBookProps.mock.lastCall?.[0].onSelectPrice).toBeUndefined();
  });

  it('routes an explicit Conditional order-book selection to Trigger Price', () => {
    mockTradeForm = { bboEnabled: false, orderType: 'conditional' };
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        tradeConfigurationReady: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const onSelectPrice = mockOrderBookProps.mock.lastCall?.[0].onSelectPrice;
    expect(onSelectPrice).toEqual(expect.any(Function));
    act(() => onSelectPrice('101.23', { type: 'tradePrice' }));
    expect(mockSelectOrderBookPrice).toHaveBeenCalledWith(
      '101.23',
      'hyperliquid::BTC',
      { type: 'tradePrice' },
    );
    expect(mockTriggerImpact).toHaveBeenCalledWith({
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
  });

  it('dismisses the keyboard for a frozen non-price input intent', () => {
    mockTradeFocusedLeg = 'tp';
    mockOrderBookPriceIntent = { type: 'dismissKeyboard' };
    mockTradeForm = { bboEnabled: false, orderType: 'limit' };
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        tradeConfigurationReady: true,
      }),
    );
    const dismiss = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(() => undefined);

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const startIntent =
      mockOrderBookProps.mock.lastCall?.[0].onSelectPriceIntentStart;
    expect(startIntent()).toEqual({ type: 'dismissKeyboard' });
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(mockSelectOrderBookPrice).not.toHaveBeenCalled();
    expect(mockTriggerImpact).not.toHaveBeenCalled();
  });

  it('vibrates once for an empty order-book level without writing a price', () => {
    mockTradeForm = { bboEnabled: false, orderType: 'limit' };
    mockOrderBookSelectionOutcome = 'invalidPrice';
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        tradeConfigurationReady: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const onSelectPrice = mockOrderBookProps.mock.lastCall?.[0].onSelectPrice;
    act(() => onSelectPrice(null, { type: 'tradePrice' }));
    expect(mockSelectOrderBookPrice).toHaveBeenCalledWith(
      null,
      'hyperliquid::BTC',
      { type: 'tradePrice' },
    );
    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);

    mockTriggerImpact.mockClear();
    mockOrderBookSelectionOutcome = 'rejected';
    act(() => onSelectPrice('99', { type: 'tradePrice' }));
    expect(mockTriggerImpact).not.toHaveBeenCalled();
  });

  it('routes unified non-USDC Trade add-funds to the current quote Swap', () => {
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        account: { assets: [], mode: 'unified' },
      }),
    );
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'DOGE-USDE',
          marketKey: 'hyperliquid::DOGE-USDE',
          marketData: { maxLeverage: 10, onlyIsolated: false },
          quoteAsset: 'USDE',
        },
        tradeConfigurationReady: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(mockTradeFormProps.mock.lastCall?.[0]).toMatchObject({
      addFundsMode: 'swap',
    });
    act(() => mockTradeFormProps.mock.lastCall?.[0].onAddFunds());
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'swap',
      targetAsset: 'USDE',
    });
  });

  it('keeps the close editor mounted under the confirmation sheet', () => {
    const closeEditor = {
      account: { address: '0x1', type: 'watch' },
      market: {
        displayBase: 'BTC',
        displayPair: 'BTCUSDC',
        markPrice: '60000',
        midPrice: '60000',
        pxDecimals: 0,
        quoteAsset: 'USDC',
        sourceTag: 'xyz',
        szDecimals: 4,
      },
      position: {
        baseSize: '1',
        coin: 'BTC',
        direction: 'long',
        key: 'BTC',
        leverage: 5,
      },
    };
    const closeReview = {
      inputSource: 'slider',
      limitPrice: null,
      midPrice: '60000',
      orderType: 'market',
      percent: 100,
      referencePrice: '60000',
      size: '1',
    };
    mockUsePerpsProPositionActions.mockReturnValue(
      createPositionActionsState({ closeEditor, closeReview }),
    );
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('close-position-sheet')).toBeTruthy();
    expect(screen.getByTestId('close-confirmation-sheet')).toBeTruthy();
    expect(mockClosePositionSheetProps.mock.lastCall?.[0]).toMatchObject({
      coveredByReview: true,
      visible: true,
    });
    expect(mockCloseConfirmationSheetProps.mock.lastCall?.[0]).toMatchObject({
      market: expect.objectContaining({ sourceTag: 'xyz' }),
      visible: true,
    });
  });

  it('keeps one fixed scroll owner and reserves stable overlay lead-in geometry', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const scroll = screen.getByTestId('perps-pro-scroll');
    const tradeScrollBridge = screen.getByTestId(
      'perps-pro-trade-scroll-bridge',
    );
    expect(scroll.props.stickyHeaderIndices).toEqual([]);
    expect(StyleSheet.flatten(scroll.props.style)?.transform).toBeUndefined();
    expect(tradeScrollBridge.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getAllByTestId('perps-pro-trade-scroll-bridge')).toHaveLength(
      1,
    );
    expect(screen.getByTestId('pro-header').props.showBottomDivider).toBe(true);
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 700, width: 393, x: 0, y: 0 } },
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-scroll').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1196 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-header-lead-in-spacer').props.style,
      ),
    ).toMatchObject({ height: 56 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-lead-in-spacer').props.style,
      ),
    ).toMatchObject({ height: 40 });
    const marketOverlayStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-overlay').props.style,
    );
    const marketTranslateY = marketOverlayStyle?.transform?.[0]
      ?.translateY as unknown as number | { __getValue: () => number };
    expect(marketOverlayStyle).toEqual(expect.objectContaining({ height: 40 }));
    expect(
      typeof marketTranslateY === 'number'
        ? marketTranslateY
        : marketTranslateY.__getValue(),
    ).toBe(56);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-info-tabs-spacer').props.style,
      ),
    ).toMatchObject({ height: 50 });
    const infoTabsOverlayStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-info-tabs-overlay').props.style,
    );
    expect(infoTabsOverlayStyle).toEqual(
      expect.objectContaining({ height: 34 }),
    );
    const infoTabsTranslateY = infoTabsOverlayStyle?.transform?.[0]
      ?.translateY as unknown as number | { __getValue: () => number };
    expect(
      typeof infoTabsTranslateY === 'number'
        ? infoTabsTranslateY
        : infoTabsTranslateY.__getValue(),
    ).toBe(536);
    expect(screen.getAllByTestId('perps-pro-info-tab-account')).toHaveLength(1);
  });

  it('animates adjacent info tabs and persists only after Pager selection', () => {
    const setActiveInfoTab = jest.fn();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ setActiveInfoTab }),
    );
    const animationFrame = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 1;
      });

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
    expect(mockInfoPagerSetPage).toHaveBeenCalledWith(1);
    expect(setActiveInfoTab).not.toHaveBeenCalled();
    expect(mockUsePerpsProInfoPanel).toHaveBeenLastCalledWith(
      expect.any(String),
      'openOrders',
    );

    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 1 },
    });
    expect(setActiveInfoTab).toHaveBeenCalledWith('openOrders');
    animationFrame.mockRestore();
  });

  it('previews the top info tab during a drag without persisting it', () => {
    const setActiveInfoTab = jest.fn();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ setActiveInfoTab }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const pager = screen.getByTestId('perps-pro-info-pager');
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.49, position: 1 },
    });
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.49, position: 1 },
    });
    expect(
      screen.getByTestId('perps-pro-info-tab-openOrders').props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(setActiveInfoTab).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.51, position: 1 },
    });
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'settling' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.49, position: 1 },
    });
    expect(
      screen.getByTestId('perps-pro-info-tab-openOrders').props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(setActiveInfoTab).not.toHaveBeenCalled();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(setActiveInfoTab).toHaveBeenCalledTimes(1);
    expect(setActiveInfoTab).toHaveBeenCalledWith('openOrders');
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

  it('places the measured region alert above the Market and outside Trade', () => {
    mockTradeHasPermission = false;
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
      <PerpsProScene
        initialRegionAlertLayout={{
          height: 52,
          width: Dimensions.get('window').width - 32,
        }}
        isModeSwitching={false}
        onSwitchToSimple={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-pro-region-alert-slot')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-region-alert-overlay')).toBeTruthy();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
    expect(screen.getByTestId('trade-form')).toBeTruthy();
    expect(screen.getByTestId('pro-header').props.showBottomDivider).toBe(true);

    expect(screen.getByTestId('perps-region-alert').props.bottomSpacing).toBe(
      4,
    );
    expect(screen.getByTestId('perps-region-alert').props.topSpacing).toBe(8);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-region-alert-slot').props.style,
      ),
    ).toMatchObject({ height: 64 });
    const getMarketTranslateY = () => {
      const marketOverlayStyle = StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-overlay').props.style,
      );
      const marketTranslateY = marketOverlayStyle?.transform?.[0]
        ?.translateY as unknown as number | { __getValue: () => number };
      return typeof marketTranslateY === 'number'
        ? marketTranslateY
        : marketTranslateY.__getValue();
    };
    expect(getMarketTranslateY()).toBe(120);

    fireEvent(screen.getByTestId('perps-region-alert'), 'layout', {
      nativeEvent: {
        layout: {
          height: 52,
          width: Dimensions.get('window').width - 32,
          x: 16,
          y: 56,
        },
      },
    });
    expect(getMarketTranslateY()).toBe(120);
  });

  it('uses the account restriction before the current market resolves', () => {
    mockTradeHasPermission = false;
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({ isResolvingMarket: true }),
    );

    render(
      <PerpsProScene
        initialRegionAlertLayout={{
          height: 34,
          width: Dimensions.get('window').width - 32,
        }}
        isModeSwitching={false}
        onSwitchToSimple={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-region-alert')).toBeOnTheScreen();
    expect(screen.getByTestId('pro-header').props.showBottomDivider).toBe(true);
    expect(screen.getByTestId('market-bar-skeleton')).toBeOnTheScreen();
    const marketOverlayStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-overlay').props.style,
    );
    const marketTranslateY = marketOverlayStyle?.transform?.[0]
      ?.translateY as unknown as number | { __getValue: () => number };
    expect(
      typeof marketTranslateY === 'number'
        ? marketTranslateY
        : marketTranslateY.__getValue(),
    ).toBe(102);
  });

  it('waits for the restricted alert measurement before painting positioned overlays', () => {
    mockTradeHasPermission = false;
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('perps-region-alert')).toBeOnTheScreen();
    expect(screen.queryByTestId('perps-pro-market-overlay')).toBeNull();
    expect(screen.queryByTestId('perps-pro-info-tabs-overlay')).toBeNull();

    fireEvent(screen.getByTestId('perps-region-alert'), 'layout', {
      nativeEvent: {
        layout: {
          height: 52,
          width: Dimensions.get('window').width - 32,
          x: 16,
          y: 56,
        },
      },
    });

    const marketOverlayStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-overlay').props.style,
    );
    const marketTranslateY = marketOverlayStyle?.transform?.[0]
      ?.translateY as unknown as number | { __getValue: () => number };
    expect(
      typeof marketTranslateY === 'number'
        ? marketTranslateY
        : marketTranslateY.__getValue(),
    ).toBe(120);
    expect(screen.getByTestId('perps-pro-info-tabs-overlay')).toBeOnTheScreen();
  });

  it('rejects a cached restricted alert measurement from another width', () => {
    mockTradeHasPermission = false;
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    render(
      <PerpsProScene
        initialRegionAlertLayout={{ height: 52, width: 100 }}
        isModeSwitching={false}
        onSwitchToSimple={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('perps-pro-market-overlay')).toBeNull();
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

  it('renders the zero-value Account Summary as ready without an empty illustration', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        account: {
          assets: [],
          diagnostics: {
            complete: true,
            unresolvedDexes: [],
            unpricedNonZeroAssets: [],
          },
          metrics: [],
          mode: 'standard',
          primaryKey: 'balance',
          primaryValue: '0',
          titleKey: 'perpsAccountSummary',
          unrealizedPnl: '0',
        },
        accountState: 'ready',
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('perps-pro-account-summary')).toBeTruthy();
    expect(screen.getAllByText('$0.00')).toHaveLength(2);
    expect(screen.getByText('page.perps.pro.account.deposit')).toBeTruthy();
    expect(screen.getByText('page.perps.pro.account.withdraw')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-account-state-empty')).toBeNull();
  });

  it('opens the Unified USDC Account action as an editable source Swap', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        account: {
          assets: [
            {
              action: 'swap',
              available: '10',
              coin: 'USDC',
              fullName: 'USD Coin',
              key: 'unified:0',
              ledger: 'unified',
              total: '10',
              usdValue: '10',
            },
          ],
          diagnostics: {
            complete: true,
            unresolvedDexes: [],
            unpricedNonZeroAssets: [],
          },
          metrics: [],
          mode: 'unified',
          primaryKey: 'accountValue',
          primaryValue: '10',
          titleKey: 'accountSummary',
          unrealizedPnl: '0',
        },
        accountState: 'ready',
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('account-asset-unified:0'));

    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'swap',
      sourceAsset: 'USDC',
      targetAsset: 'USDC',
    });
  });

  it('renders approved Position and Open Orders empty rows only for authoritative emptiness', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positionsEmpty: true,
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('perps-pro-positions-empty-light')).toBeTruthy();
    expect(screen.getByText('page.perps.pro.positions.empty')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-positions-controls')).toBeNull();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        openOrdersEmpty: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-open-orders-empty-light'),
    ).toBeTruthy();
    expect(screen.getByText('page.perps.pro.openOrders.empty')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
  });

  it('keeps controls when a filter has no visible rows but the source is not empty', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positions: [],
        positionsEmpty: false,
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.getByTestId('perps-pro-positions-controls')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-positions-empty')).toBeTruthy();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        openOrders: [],
        openOrdersEmpty: false,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.getByTestId('perps-pro-open-orders-controls')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-open-orders-empty')).toBeTruthy();
  });

  it('preserves the empty-state trailing distance after populated account, position, and order rows', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        account: {
          assets: [],
          diagnostics: {
            complete: true,
            unresolvedDexes: [],
            unpricedNonZeroAssets: [],
          },
          metrics: [],
          mode: 'standard',
          primaryKey: 'balance',
          primaryValue: '0',
          titleKey: 'perpsAccountSummary',
          unrealizedPnl: '0',
        },
        accountState: 'ready',
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const scroll = screen.getByTestId('perps-pro-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 700, width: 393, x: 0, y: 0 } },
    });

    expect(
      StyleSheet.flatten(scroll.props.contentContainerStyle),
    ).toMatchObject({ minHeight: 1196, paddingBottom: 390 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positions: [{ coin: 'BTC', key: 'BTC' }],
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-scroll').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1196, paddingBottom: 390 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        openOrders: [{ coin: 'BTC', key: 'order-1' }],
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-scroll').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1196, paddingBottom: 390 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positionsEmpty: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-scroll').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1196, paddingBottom: 32 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountState: 'loading',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-scroll').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1196, paddingBottom: 32 });
  });

  it('closes the local funding overlay when the active account changes', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ accountIdentity: 'account-a', accountState: 'ready' }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByText('page.perps.pro.account.deposit'));
    expect(screen.getByTestId('funding-overlay')).toBeTruthy();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ accountIdentity: 'account-b', accountState: 'ready' }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.queryByTestId('funding-overlay')).toBeNull();
  });
});
