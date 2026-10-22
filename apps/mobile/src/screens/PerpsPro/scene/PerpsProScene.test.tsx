import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import {
  Animated as NativeAnimated,
  AppState,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';

let mockIsLight = true;
const mockUsePerpsProScene = jest.fn();
const mockUsePerpsProInfoPanel = jest.fn();
const mockMarketSelectorPresent = jest.fn();
const mockOrderBookRender = jest.fn();
const mockOrderBookProps = jest.fn();
const mockTradeFormProps = jest.fn();
const mockFundingOverlayProps = jest.fn();
const mockEnableUnifiedProps = jest.fn();
const mockExecuteEnableUnified = jest.fn(async () => undefined);
const mockEnsurePerpsActionApproval = jest.fn(async () => undefined);
const mockIsPerpsActionUserCancelled = jest.fn(() => false);
const mockShowToast = jest.fn();
const mockDismissKeyboardThen = jest.fn((action: () => void) => action());
const mockConfirmCancelAll = jest.fn();
const mockConfirmCancelOrder = jest.fn();
const mockRequestCloseAll = jest.fn();
const mockIsOrderPending = () => false;
const mockManageMarginOpen = jest.fn();
const mockTransferOpen = jest.fn();
const mockTranslate = (key: string) => key;
const mockKlineProps = jest.fn();
const mockUsePerpsProPositionActions = jest.fn();
const mockUsePerpsProPositionTpSl = jest.fn();
const mockUsePerpsProOpenOrderEdit = jest.fn();
const mockOpenOrderCardProps = jest.fn();
const mockConditionalOrderEditSheetProps = jest.fn();
const mockClosePositionSheetProps = jest.fn();
const mockCloseConfirmationSheetProps = jest.fn();
const mockSelectOrderBookPrice = jest.fn();
const mockGetOrderBookPriceIntent = jest.fn();
const mockTriggerImpact = jest.fn();
let mockRowTouchesDown:
  | ((
      event: { allTouches: { y: number }[]; numberOfTouches: number },
      stateManager: { fail: () => void },
    ) => void)
  | null = null;
let mockRowSwipeEnd:
  | ((
      event: { translationX: number; velocityX: number },
      success: boolean,
    ) => void)
  | null = null;
let mockRowSwipeBegin: (() => void) | null = null;
let mockRowSwipeStart: (() => void) | null = null;
let mockRowSwipeUpdate:
  | ((event: { translationX: number; velocityX: number }) => void)
  | null = null;
let mockRowSwipeFinalize: (() => void) | null = null;
const mockPendingTimingCallbacks: ((finished: boolean) => void)[] = [];
let mockTradeHasPermission = true;
let mockTradeFocusedLeg: 'sl' | 'tp' | null = null;
let mockOrderBookPriceIntent:
  | { type: 'attachedTpSlPrice'; leg: 'sl' | 'tp' }
  | { type: 'dismissKeyboard' }
  | { type: 'tradePrice' } = { type: 'tradePrice' };
let mockOrderBookSelectionOutcome: 'accepted' | 'invalidPrice' | 'rejected' =
  'accepted';
const initialPlatform = Platform.OS;
let mockTradeForm: {
  bboEnabled: boolean;
  orderType: 'conditional' | 'limit' | 'market';
} = { bboEnabled: false, orderType: 'market' };

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  const useSharedValue = (value: unknown) =>
    ReactModule.useRef({ value }).current;
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType) => Component,
      ScrollView: ReactNative.ScrollView,
      Text: ReactNative.Text,
      useSharedValue,
      View: ReactNative.View,
    },
    cancelAnimation: jest.fn(),
    dispatchCommand: (
      ref: { current: Record<string, (...args: unknown[]) => void> },
      name: string,
      args: unknown[],
    ) => ref.current[name](...args),
    runOnUI: (callback: (...args: unknown[]) => unknown) => callback,
    Easing: { bezier: jest.fn(() => 'ease-out') },
    ReduceMotion: { System: 'system' },
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
    useAnimatedReaction: jest.fn(),
    useAnimatedScrollHandler: () => jest.fn(),
    useDerivedValue: (factory: () => unknown) => ({
      value: factory(),
    }),
    useAnimatedStyle: (factory: () => object) => factory(),
    useEvent:
      (handler: (event: object) => void, eventNames?: string[]) =>
      (event: { nativeEvent?: object }) =>
        handler({
          ...(event.nativeEvent ?? event),
          eventName: eventNames?.[0] ?? 'onPageScroll',
        }),
    useScrollViewOffset: (_ref: unknown, offset: unknown) => offset,
    useSharedValue,
    withDecay: jest.fn(({ velocity }: { velocity: number }) => velocity),
    withTiming: (
      target: number,
      _config: unknown,
      callback?: (finished: boolean) => void,
    ) => {
      if (callback) {
        mockPendingTimingCallbacks.push(callback);
      }
      return target;
    },
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

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: (...args: unknown[]) =>
    mockIsPerpsActionUserCancelled(...args),
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsurePerpsActionApproval(...args),
}));

jest.mock('@/hooks/perps/actions/enableUnifiedAccount', () => ({
  executeEnablePerpsUnifiedAccount: (...args: unknown[]) =>
    mockExecuteEnableUnified(...args),
  isPerpsUnifiedCollateralMode: (value: string) =>
    value === 'unifiedAccount' || value === 'portfolioMargin',
}));

jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('@/screens/Perps/components/EnableUnifiedAccountPopup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    EnableUnifiedAccountPopup: (props: object) => {
      mockEnableUnifiedProps(props);
      return ReactModule.createElement(View, {
        testID: 'enable-unified-account-popup',
      });
    },
  };
});

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
  const createPan = () => {
    const panGesture: Record<string, jest.Mock> = {};
    [
      'activeOffsetX',
      'failOffsetY',
      'manualActivation',
      'maxPointers',
      'runOnJS',
      'shouldCancelWhenOutside',
      'withTestId',
    ].forEach(method => {
      panGesture[method] = jest.fn(() => panGesture);
    });
    [
      'onBegin',
      'onEnd',
      'onFinalize',
      'onStart',
      'onTouchesDown',
      'onTouchesMove',
      'onUpdate',
    ].forEach(method => {
      panGesture[method] = jest.fn(callback => {
        panGesture[`__${method}`] = callback;
        return panGesture;
      });
    });
    return panGesture;
  };
  return {
    Pressable: require('react-native').Pressable,
    Gesture: {
      Pan: createPan,
      Tap: () => {
        const tap: Record<string, jest.Mock> = {};
        for (const method of [
          'maxDistance',
          'runOnJS',
          'onBegin',
          'onEnd',
          'onFinalize',
        ]) {
          tap[method] = jest.fn(() => tap);
        }
        return tap;
      },
      Exclusive: (...gestures: unknown[]) => gestures,
    },
    GestureDetector: ({
      children,
      gesture,
    }: {
      children: React.ReactElement<{ testID?: string }>;
      gesture: ReturnType<typeof createPan>;
    }) => {
      if (children.props.testID === 'perps-pro-info-list-pager') {
        mockRowTouchesDown = gesture.__onTouchesDown;
        mockRowSwipeBegin = gesture.__onBegin;
        mockRowSwipeStart = gesture.__onStart;
        mockRowSwipeUpdate = gesture.__onUpdate;
        mockRowSwipeEnd = gesture.__onEnd;
        mockRowSwipeFinalize = gesture.__onFinalize;
      }
      return children;
    },
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
jest.mock('@/assets2024/icons/perps/PerpsProInfoCheckboxChecked.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProEmptyLight.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProEmptyDark.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock(
  '@/screens/PerpsShared/components/PerpsPortfolioBreakdownExplanation',
  () => ({
    useShowPerpsPortfolioBreakdown: () => ({
      showPortfolioBreakdown: jest.fn(),
    }),
  }),
);

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
      isLight: mockIsLight,
      styles: getStyle({ colors2024, isLight: mockIsLight }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
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
    PerpsProConditionalOrderEditSheet: (props: object) => {
      mockConditionalOrderEditSheetProps(props);
      return null;
    },
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
    PerpsProOpenOrderCard: (props: object) => {
      mockOpenOrderCardProps(props);
      return ReactModule.createElement(View, { testID: 'open-order-card' });
    },
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
  usePerpsProDismissKeyboard: () => mockDismissKeyboardThen,
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
    isOrderPending: mockIsOrderPending,
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
    open: mockManageMarginOpen,
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
    open: mockTransferOpen,
    pending: false,
  }),
}));

const { PerpsProScene } =
  require('./PerpsProScene') as typeof import('./PerpsProScene');
const { PerpsProTabIndicator } =
  require('../components/common/PerpsProTabIndicator') as typeof import('../components/common/PerpsProTabIndicator');
const { PerpsProInfoSingleList } =
  require('../components/info/PerpsProInfoSingleList') as typeof import('../components/info/PerpsProInfoSingleList');
const { CollapsibleHeaderLayer, CollapsiblePinnedLayer, SceneList } =
  require('@rabby-wallet/rn-collapsible-scene-view') as typeof import('@rabby-wallet/rn-collapsible-scene-view');
const { scrollPerpsProTradeAboveKeyboard } =
  require('../components/common/perpsProKeyboardSession') as typeof import('../components/common/perpsProKeyboardSession');

const createSceneState = (overrides: Record<string, unknown> = {}) => ({
  accountLeverageConfiguration: null,
  cancelPendingMarketSelection: jest.fn(),
  currentMarket: null,
  executionActive: false,
  fundingHistoryEnabled: false,
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

const createInfoState = (overrides: Record<string, unknown> = {}) => {
  const openOrders = (overrides.openOrders ?? []) as unknown[];
  const positions = (overrides.positions ?? []) as unknown[];
  return {
    account: { assets: [], mode: 'standard' },
    accountIdentity: 'test-account',
    accountState: 'loading',
    activeInfoTab: 'account',
    allOpenOrdersCount: 0,
    allPositionsCount: 0,
    allPositionsByCoin: new Map(),
    currentAccount: null,
    fundingAccountValue: null,
    fundingAccountValueReady: false,
    hideOtherOpenOrderSymbols: false,
    hideOtherPositionSymbols: false,
    openOrderCategory: 'basic',
    openOrderCollectionPresentation:
      overrides.openOrderCollectionPresentation ??
      (openOrders.length > 0 ? 'populated' : 'unresolved'),
    openOrderCommandCandidates: [],
    openOrderCounts: { basic: 0, conditional: 0, unsupported: 0 },
    openOrders,
    pendingFundingCount: 0,
    positionCollectionPresentation:
      overrides.positionCollectionPresentation ??
      (positions.length > 0 ? 'populated' : 'unresolved'),
    positions,
    retryAccount: jest.fn(),
    setActiveInfoTab: jest.fn(),
    setHideOtherOpenOrderSymbols: jest.fn(),
    setHideOtherPositionSymbols: jest.fn(),
    setOpenOrderCategory: jest.fn(),
    userAbstraction: 'default',
    userAbstractionReady: false,
    ...overrides,
  };
};

const installOptimisticInfoPanelMock = (
  persist = jest.fn(),
  overrides: Record<string, unknown> = {},
) => {
  mockUsePerpsProInfoPanel.mockImplementation(function useInfoPanel() {
    const [activeInfoTab, setActiveInfoTab] = React.useState<
      'positions' | 'openOrders' | 'account'
    >('account');
    return createInfoState({
      ...overrides,
      activeInfoTab,
      setActiveInfoTab: (tab: typeof activeInfoTab) => {
        setActiveInfoTab(tab);
        persist(tab);
      },
    });
  });
  return persist;
};

const measureRowPager = () => {
  fireEvent(screen.getByTestId('perps-pro-info-list-pager'), 'layout', {
    nativeEvent: { layout: { height: 700, width: 400, x: 0, y: 0 } },
  });
};

const dragRows = (translationX: number, velocityX = 0) => {
  expect(mockRowSwipeBegin).not.toBeNull();
  expect(mockRowSwipeStart).not.toBeNull();
  expect(mockRowSwipeUpdate).not.toBeNull();
  act(() => {
    mockRowSwipeBegin!();
    mockRowSwipeStart!();
    mockRowSwipeUpdate!({ translationX, velocityX });
  });
};

const releaseRows = (translationX: number, success = true, velocityX = 0) => {
  expect(mockRowSwipeEnd).not.toBeNull();
  expect(mockRowSwipeFinalize).not.toBeNull();
  act(() => {
    mockRowSwipeEnd!({ translationX, velocityX }, success);
    mockRowSwipeFinalize!();
  });
};

const finishRowSettle = () => {
  expect(mockPendingTimingCallbacks).toHaveLength(1);
  act(() => mockPendingTimingCallbacks.shift()!(true));
};

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
  skipCloseConfirmation: false,
  toggleSkipCloseConfirmation: jest.fn(),
  updateLeverage: jest.fn(),
  ...overrides,
});

describe('PerpsProScene market loading states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLight = true;
    mockDismissKeyboardThen.mockReset();
    mockDismissKeyboardThen.mockImplementation(action => action());
    mockIsPerpsActionUserCancelled.mockReturnValue(false);
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
    mockRowTouchesDown = null;
    mockRowSwipeBegin = null;
    mockRowSwipeStart = null;
    mockRowSwipeUpdate = null;
    mockRowSwipeEnd = null;
    mockRowSwipeFinalize = null;
    mockPendingTimingCallbacks.length = 0;
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    mockUsePerpsProInfoPanel.mockReset();
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
      isEditUnavailable: () => false,
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
      isEditUnavailable: () => false,
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
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: initialPlatform,
    });
  });

  it('keeps row rendering stable for unrelated scene and info-wrapper updates', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    const info = createInfoState({ activeInfoTab: 'positions' });
    mockUsePerpsProInfoPanel.mockReturnValue(info);
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const firstRenderer = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .renderItem;

    // Hooks can return a new wrapper while all row-relevant facts stay equal.
    mockUsePerpsProInfoPanel.mockReturnValue({
      ...info,
      pendingFundingCount: 1,
    });
    view.rerender(<PerpsProScene {...props} />);
    expect(
      screen.UNSAFE_getByType(PerpsProInfoSingleList).props.renderItem,
    ).toBe(firstRenderer);

    mockUsePerpsProInfoPanel.mockReturnValue({
      ...info,
      hideOtherPositionSymbols: true,
    });
    view.rerender(<PerpsProScene {...props} />);
    expect(
      screen.UNSAFE_getByType(PerpsProInfoSingleList).props.renderItem,
    ).not.toBe(firstRenderer);
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(1);
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

  it('mounts the single list for the resolved tab without exposing fallback rows', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ activeInfoTab: null }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.queryByTestId('perps-pro-info-list')).toBeNull();
    expect(screen.queryByTestId('perps-pro-info-tabs-overlay')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-section')).toBeNull();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ activeInfoTab: 'positions' }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('perps-pro-info-list')).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(1);
    expect(screen.getByTestId('perps-pro-trade-section')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-positions-controls')).toBeTruthy();
    expect(screen.queryByTestId('account-skeleton')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-info-tab-positions').props
        .accessibilityState,
    ).toEqual({ selected: true });
  });

  it('rejects tab swipes starting over the trade/header or using multiple fingers', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const tradeTouch = { fail: jest.fn() };
    const rowTouch = { fail: jest.fn() };
    const multiTouch = { fail: jest.fn() };
    act(() => {
      mockRowTouchesDown?.(
        { allTouches: [{ y: 200 }], numberOfTouches: 1 },
        tradeTouch,
      );
      mockRowTouchesDown?.(
        { allTouches: [{ y: 700 }], numberOfTouches: 1 },
        rowTouch,
      );
      mockRowTouchesDown?.(
        { allTouches: [{ y: 700 }, { y: 710 }], numberOfTouches: 2 },
        multiTouch,
      );
    });
    expect(tradeTouch.fail).toHaveBeenCalledTimes(1);
    expect(rowTouch.fail).not.toHaveBeenCalled();
    expect(multiTouch.fail).toHaveBeenCalledTimes(1);
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

  it.each([
    ['Unified', 'unified', 'unifiedAccount'],
    ['Portfolio Margin', 'portfolioMargin', 'portfolioMargin'],
  ] as const)(
    'approves Agent before routing %s non-USDC Trade add-funds to the current quote Swap',
    async (_label, accountMode, userAbstraction) => {
      let resolveApproval: (() => void) | undefined;
      mockEnsurePerpsActionApproval.mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            resolveApproval = resolve;
          }),
      );
      const account = { address: '0x1', type: 'PrivateKeyring' };
      mockUsePerpsProInfoPanel.mockReturnValue(
        createInfoState({
          account: { assets: [], mode: accountMode },
          currentAccount: account,
          fundingAccountValue: '12',
          fundingAccountValueReady: true,
          userAbstraction,
          userAbstractionReady: true,
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
      act(() => {
        mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
      });
      expect(mockEnsurePerpsActionApproval).toHaveBeenCalledWith(account, {
        builderFee: false,
      });
      expect(mockFundingOverlayProps).not.toHaveBeenCalled();

      await act(async () => {
        resolveApproval?.();
        await Promise.resolve();
      });
      expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
        mode: 'swap',
        targetAsset: 'USDE',
      });
      expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
        visible: false,
      });
    },
  );

  it('drops a frozen Deposit tap when the account changes before keyboard dismissal', () => {
    let pendingAction: (() => void) | null = null;
    mockDismissKeyboardThen.mockImplementation(action => {
      pendingAction = action;
    });
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: { address: '0x1', type: 'PrivateKeyring' },
        fundingAccountValue: '0',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    act(() => mockTradeFormProps.mock.lastCall?.[0].onAddFunds());
    expect(mockFundingOverlayProps).not.toHaveBeenCalled();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-b',
        currentAccount: { address: '0x2', type: 'PrivateKeyring' },
        fundingAccountValue: '0',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    act(() => pendingAction?.());

    expect(mockEnsurePerpsActionApproval).not.toHaveBeenCalled();
    expect(mockFundingOverlayProps).not.toHaveBeenCalled();
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });
  });

  it('keeps the tap-time quote while keyboard dismissal is pending', async () => {
    let pendingAction: (() => void) | null = null;
    mockDismissKeyboardThen.mockImplementation(action => {
      pendingAction = action;
    });
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    act(() => mockTradeFormProps.mock.lastCall?.[0].onAddFunds());
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'DOGE-USDH',
          marketKey: 'hyperliquid::DOGE-USDH',
          marketData: { maxLeverage: 10, onlyIsolated: false },
          quoteAsset: 'USDH',
        },
        tradeConfigurationReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      pendingAction?.();
      await Promise.resolve();
    });

    expect(mockEnsurePerpsActionApproval).toHaveBeenCalledWith(account, {
      builderFee: false,
    });
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: true,
    });
    await act(async () => {
      await mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
    });
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'swap',
      targetAsset: 'USDE',
    });
  });

  it('prompts a standard account to enable Unified Account before USDE Swap', async () => {
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    await act(async () => {
      await mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });
    expect(mockEnsurePerpsActionApproval).toHaveBeenCalledWith(account, {
      builderFee: false,
    });
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: true,
    });

    await act(async () => {
      await mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
    });
    expect(mockExecuteEnableUnified).toHaveBeenCalledWith(account);
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'swap',
      targetAsset: 'USDE',
    });
  });

  it.each([
    ['user cancellation', true, 'User cancelled'],
    ['non-cancellation failure', false, 'Enable failed'],
  ] as const)(
    'keeps the Unified prompt open without opening Swap after %s',
    async (_label, isCancellation, message) => {
      const account = { address: '0x1', type: 'PrivateKeyring' };
      const error = new Error(message);
      mockExecuteEnableUnified.mockRejectedValueOnce(error);
      mockIsPerpsActionUserCancelled.mockReturnValueOnce(isCancellation);
      mockUsePerpsProInfoPanel.mockReturnValue(
        createInfoState({
          currentAccount: account,
          fundingAccountValue: '12',
          fundingAccountValueReady: true,
          userAbstraction: 'default',
          userAbstractionReady: true,
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
      await act(async () => {
        mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
        await Promise.resolve();
      });
      expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
        visible: true,
      });

      await act(async () => {
        await mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
      });

      expect(mockExecuteEnableUnified).toHaveBeenCalledWith(account);
      expect(mockFundingOverlayProps).not.toHaveBeenCalled();
      expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
        visible: true,
      });
      if (isCancellation) {
        expect(mockShowToast).not.toHaveBeenCalled();
      } else {
        expect(mockShowToast).toHaveBeenCalledWith(message, 'error');
      }
    },
  );

  it.each([
    ['zero value', '0', true],
    ['unready value', '12', false],
  ] as const)(
    'drops a pending Unified confirmation after the funding fact becomes %s',
    async (_label, fundingAccountValue, fundingAccountValueReady) => {
      const account = { address: '0x1', type: 'PrivateKeyring' };
      const readyInfo = createInfoState({
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
      });
      mockUsePerpsProInfoPanel.mockReturnValue(readyInfo);
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
      const view = render(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      await act(async () => {
        await mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
      });
      expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
        visible: true,
      });

      mockUsePerpsProInfoPanel.mockReturnValue(
        createInfoState({
          currentAccount: account,
          fundingAccountValue,
          fundingAccountValueReady,
          userAbstraction: 'default',
          userAbstractionReady: true,
        }),
      );
      view.rerender(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      await act(async () => {
        await mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
      });

      expect(mockExecuteEnableUnified).not.toHaveBeenCalled();
      expect(mockFundingOverlayProps).not.toHaveBeenCalled();
      expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
        visible: false,
      });
    },
  );

  it('skips a redundant Unified mutation when the account mode changes before confirmation', async () => {
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      await mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: true,
    });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        account: { assets: [], mode: 'unified' },
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'unifiedAccount',
        userAbstractionReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      await mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
    });

    expect(mockExecuteEnableUnified).not.toHaveBeenCalled();
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'swap',
      targetAsset: 'USDE',
    });
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });
  });

  it('routes a ready zero-value non-USDC account to Deposit without continuing into Unified', async () => {
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        currentAccount: account,
        fundingAccountValue: '0',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
      addFundsMode: 'deposit',
    });
    await act(async () => {
      await mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'deposit',
      targetAsset: 'USDC',
    });
    expect(mockEnsurePerpsActionApproval).not.toHaveBeenCalled();
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });

    act(() => mockFundingOverlayProps.mock.lastCall?.[0].onClose());

    expect(mockEnsurePerpsActionApproval).not.toHaveBeenCalled();
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });
  });

  it('does not execute an add-funds route before the funding fact is ready', async () => {
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        currentAccount: { address: '0x1', type: 'PrivateKeyring' },
        fundingAccountValue: '12',
        fundingAccountValueReady: false,
        userAbstraction: 'default',
        userAbstractionReady: true,
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

    await act(async () => {
      await mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });

    expect(mockEnsurePerpsActionApproval).not.toHaveBeenCalled();
    expect(mockFundingOverlayProps).not.toHaveBeenCalled();
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });
  });

  it('drops a pending Standard funding continuation when the account identity changes', async () => {
    let resolveApproval: (() => void) | undefined;
    mockEnsurePerpsActionApproval.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveApproval = resolve;
        }),
    );
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    act(() => {
      mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-b',
        currentAccount: { address: '0x2', type: 'PrivateKeyring' },
        fundingAccountValue: '20',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      resolveApproval?.();
      await Promise.resolve();
    });

    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });
    expect(mockFundingOverlayProps).not.toHaveBeenCalled();
  });

  it('drops a pending funding continuation when the live funding value is no longer positive', async () => {
    let resolveApproval: (() => void) | undefined;
    mockEnsurePerpsActionApproval.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveApproval = resolve;
        }),
    );
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    act(() => {
      mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: account,
        fundingAccountValue: '0',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      resolveApproval?.();
      await Promise.resolve();
    });

    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
    });
    expect(mockFundingOverlayProps).not.toHaveBeenCalled();
  });

  it('freezes the account and quote while Standard Agent approval is pending', async () => {
    let resolveApproval: (() => void) | undefined;
    mockEnsurePerpsActionApproval.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveApproval = resolve;
        }),
    );
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
      }),
    );
    const usdeScene = createSceneState({
      currentMarket: {
        canonicalCoin: 'DOGE-USDE',
        marketKey: 'hyperliquid::DOGE-USDE',
        marketData: { maxLeverage: 10, onlyIsolated: false },
        quoteAsset: 'USDE',
      },
      tradeConfigurationReady: true,
    });
    mockUsePerpsProScene.mockReturnValue(usdeScene);
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    act(() => {
      mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });

    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'DOGE-USDH',
          marketKey: 'hyperliquid::DOGE-USDH',
          marketData: { maxLeverage: 10, onlyIsolated: false },
          quoteAsset: 'USDH',
        },
        tradeConfigurationReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      resolveApproval?.();
      await Promise.resolve();
    });

    await act(async () => {
      await mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
    });
    expect(mockEnsurePerpsActionApproval).toHaveBeenCalledWith(account, {
      builderFee: false,
    });
    expect(mockExecuteEnableUnified).toHaveBeenCalledWith(account);
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      mode: 'swap',
      targetAsset: 'USDE',
    });
  });

  it('does not open a frozen Swap after the account changes during Unified confirmation', async () => {
    let resolveUnifiedEnable: (() => void) | undefined;
    mockExecuteEnableUnified.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveUnifiedEnable = resolve;
        }),
    );
    const account = { address: '0x1', type: 'PrivateKeyring' };
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-a',
        currentAccount: account,
        fundingAccountValue: '12',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      await mockTradeFormProps.mock.lastCall?.[0].onAddFunds();
    });
    let enablePromise: Promise<void> | undefined;
    act(() => {
      enablePromise = mockEnableUnifiedProps.mock.lastCall?.[0].onConfirm();
    });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountIdentity: 'account-b',
        currentAccount: { address: '0x2', type: 'PrivateKeyring' },
        fundingAccountValue: '20',
        fundingAccountValueReady: true,
        userAbstraction: 'default',
        userAbstractionReady: true,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    await act(async () => {
      resolveUnifiedEnable?.();
      await enablePromise;
    });

    expect(mockFundingOverlayProps).not.toHaveBeenCalled();
    expect(mockEnableUnifiedProps.mock.lastCall?.[0]).toMatchObject({
      visible: false,
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

  it('shares one stable native scroll value between the list and every floating layer', () => {
    installOptimisticInfoPanelMock();
    mockTradeHasPermission = false;
    mockUsePerpsProScene.mockReturnValue(createSceneState());
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

    const nativeScrollY = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .nativeScrollY;
    expect(nativeScrollY).toBeInstanceOf(NativeAnimated.Value);
    expect(screen.UNSAFE_getByType(SceneList).props.nativeScrollY).toBe(
      nativeScrollY,
    );
    const pinnedLayers = screen.UNSAFE_getAllByType(CollapsiblePinnedLayer);
    expect(pinnedLayers.map(layer => layer.props.testID).sort()).toEqual([
      'perps-pro-info-tabs-overlay',
      'perps-pro-market-overlay',
      'perps-pro-region-alert-overlay',
    ]);
    for (const layer of [
      screen.UNSAFE_getByType(CollapsibleHeaderLayer),
      ...pinnedLayers,
    ]) {
      expect(layer.props.nativeScrollY).toBe(nativeScrollY);
    }

    fireEvent.press(screen.getByTestId('perps-pro-info-tab-positions'));

    expect(screen.UNSAFE_getByType(SceneList).props.nativeScrollY).toBe(
      nativeScrollY,
    );
    expect(
      screen.UNSAFE_getByType(PerpsProInfoSingleList).props.nativeScrollY,
    ).toBe(nativeScrollY);
    for (const layer of [
      screen.UNSAFE_getByType(CollapsibleHeaderLayer),
      ...screen.UNSAFE_getAllByType(CollapsiblePinnedLayer),
    ]) {
      expect(layer.props.nativeScrollY).toBe(nativeScrollY);
    }
  });

  it('keeps lead-in, trade and tab spacing inside the native list header', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const scroll = screen.getByTestId('perps-pro-info-list');
    const tradeSection = screen.getByTestId('perps-pro-trade-section');
    // Floating chrome follows the list offset; Trade stays in normal header flow.
    expect(screen.getByTestId('perps-pro-info-tabs-overlay')).toBeTruthy();
    expect(StyleSheet.flatten(scroll.props.style)?.transform).toBeUndefined();
    expect(StyleSheet.flatten(tradeSection.props.style)).toMatchObject({
      backgroundColor: 'neutral-bg-1',
    });
    expect(StyleSheet.flatten(tradeSection.props.style)?.position).not.toBe(
      'absolute',
    );
    expect(
      StyleSheet.flatten(tradeSection.props.style)?.transform,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-list-lead-in').props.style,
      ),
    ).toMatchObject({ height: 96 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-list-tabs-placeholder').props.style,
      ),
    ).toMatchObject({ height: 60 });
    const header = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .listHeader;
    expect(
      header.props.children.map(
        (child: React.ReactElement<{ testID?: string }>) => child.props.testID,
      ),
    ).toEqual([
      'perps-pro-list-lead-in',
      'perps-pro-trade-section',
      'perps-pro-list-tabs-placeholder',
    ]);
    expect(screen.getByTestId('pro-header').props).not.toHaveProperty(
      'showBottomDivider',
    );
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 700, width: 393, x: 0, y: 0 } },
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-info-list').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1202, paddingTop: 0 });
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
    ).toMatchObject({ height: 22 });
    // The tab strip is a pinned layer below the market bar.
    expect(screen.getByTestId('perps-pro-info-tabs-overlay')).toBeTruthy();
    expect(screen.getAllByTestId('perps-pro-info-tab-account')).toHaveLength(1);
  });

  it.each([true, false])(
    'keeps the six-point section divider distinct with isLight=%s',
    isLight => {
      mockIsLight = isLight;
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      render(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      const spacer = screen.getByTestId('perps-pro-info-tabs-spacer');
      const divider = spacer.children[0];
      if (typeof divider === 'string') {
        throw new Error('Missing section divider');
      }
      expect(divider.props.pointerEvents).toBe('none');
      expect(StyleSheet.flatten(divider.props.style)).toMatchObject({
        backgroundColor: isLight ? 'neutral-bg-0' : 'neutral-bg-2',
        height: 6,
        bottom: 0,
        left: 0,
        right: 0,
      });
      expect(StyleSheet.flatten(spacer.props.style)).toMatchObject({
        height: 22,
      });
    },
  );

  it('keeps Android vertical scrolling owned by one native list including Trade', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    mockUsePerpsProScene.mockReturnValue(createSceneState());

    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const scroll = screen.getByTestId('perps-pro-info-list');
    // The native list now owns vertical scrolling on Android too; the scene no
    // longer synthesises it with per-frame scrollTo calls.
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(1);
    expect(screen.queryByTestId('perps-pro-info-pager')).toBeNull();
    expect(
      within(scroll).getByTestId('perps-pro-trade-section'),
    ).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-section').props.style,
      )?.position,
    ).not.toBe('absolute');

    view.unmount();
  });

  it('commits a tab press immediately with matching data and indicator', () => {
    const persist = installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    const accountRows = list.props.data;
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
    expect(persist.mock.calls).toEqual([['openOrders']]);
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(list.props.data).not.toBe(accountRows);
    expect(
      screen.getByTestId('perps-pro-open-orders-controls'),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('perps-pro-info-tab-openOrders').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(1);
  });

  it('keeps one list and the latest data through rapid reverse tab presses', () => {
    const persist = installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    const initialAccountRows = list.props.data;
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-account'));
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-positions'));
    expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);
    expect(
      screen.getByTestId('perps-pro-positions-controls'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-info-tab-positions').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(0);
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-account'));
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(list.props.data).toEqual(initialAccountRows);
    expect(persist.mock.calls).toEqual([
      ['openOrders'],
      ['account'],
      ['positions'],
      ['account'],
    ]);
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(2);
  });

  it('commits horizontal row swipes through the same tab state and keeps boundaries local', () => {
    const persist = installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    measureRowPager();
    // Short drags and the Account end boundary do not commit another tab.
    dragRows(59);
    releaseRows(59);
    finishRowSettle();
    dragRows(-120);
    releaseRows(-120);
    finishRowSettle();
    expect(persist).not.toHaveBeenCalled();

    dragRows(120);
    releaseRows(120);
    expect(persist).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });
    finishRowSettle();
    expect(
      screen.getByTestId('perps-pro-open-orders-controls'),
    ).toBeOnTheScreen();
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(1);
    dragRows(120);
    releaseRows(120);
    expect(persist.mock.calls).toEqual([['openOrders']]);
    finishRowSettle();
    expect(
      screen.getByTestId('perps-pro-positions-controls'),
    ).toBeOnTheScreen();
    dragRows(120);
    releaseRows(120);
    finishRowSettle();
    expect(persist.mock.calls).toEqual([['openOrders'], ['positions']]);
    expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);
    expect(
      screen.getByTestId('perps-pro-info-tab-positions').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(0);
  });

  it('does not commit a cancelled or failed row swipe even past the distance threshold', () => {
    const persist = installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    const data = list.props.data;

    measureRowPager();
    dragRows(160);
    releaseRows(160, false);
    finishRowSettle();

    expect(persist).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(list.props.data).toBe(data);
    expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(2);
  });

  it('renders a non-interactive neighbouring preview without committing or invoking trade actions', () => {
    const persist = installOptimisticInfoPanelMock();
    const switchToSimple = jest.fn();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene
        isModeSwitching={false}
        onSwitchToSimple={switchToSimple}
      />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    const data = list.props.data;
    measureRowPager();

    dragRows(120);

    const preview = screen.getByTestId('scene-pager-preview', {
      includeHiddenElements: true,
    });
    expect(preview.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      pointerEvents: 'none',
    });
    expect(
      within(preview).getByTestId('perps-pro-open-orders-controls', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);
    expect(list.props.data).toBe(data);
    expect(list.props.removeClippedSubviews).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(mockConfirmCancelAll).not.toHaveBeenCalled();
    expect(mockConfirmCancelOrder).not.toHaveBeenCalled();
    expect(mockRequestCloseAll).not.toHaveBeenCalled();
    expect(mockSelectOrderBookPrice).not.toHaveBeenCalled();
    expect(mockEnsurePerpsActionApproval).not.toHaveBeenCalled();
    expect(mockExecuteEnableUnified).not.toHaveBeenCalled();
    expect(switchToSimple).not.toHaveBeenCalled();

    releaseRows(120, false);
    finishRowSettle();
    expect(
      screen.queryByTestId('scene-pager-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it('scrolls the same native list for keyboard overlap using the current tab bounds', () => {
    installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    const scrollToOffset = jest
      .spyOn(list.instance, 'scrollToOffset')
      .mockImplementation(() => undefined);
    fireEvent(screen.getByTestId('perps-pro-info-list'), 'layout', {
      nativeEvent: { layout: { height: 700, width: 393, x: 0, y: 0 } },
    });
    fireEvent(
      screen.getByTestId('perps-pro-info-list'),
      'contentSizeChange',
      393,
      2000,
    );

    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
    fireEvent(
      screen.getByTestId('perps-pro-info-list'),
      'contentSizeChange',
      393,
      1000,
    );
    act(() => scrollPerpsProTradeAboveKeyboard(450));

    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      animated: false,
      offset: 300,
    });
    act(() => scrollPerpsProTradeAboveKeyboard(-10));
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    view.unmount();
    act(() => scrollPerpsProTradeAboveKeyboard(50));
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it('returns the same native list to the top after a card market selection', async () => {
    installOptimisticInfoPanelMock(jest.fn(), {
      openOrders: [{ coin: 'BTC', key: 'order-btc' }],
    });
    const selectMarketByCoin = jest.fn(async () => true);
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({ selectMarketByCoin }),
    );
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    const scrollToOffset = jest
      .spyOn(list.instance, 'scrollToOffset')
      .mockImplementation(() => undefined);
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));

    await act(async () => {
      await mockOpenOrderCardProps.mock.lastCall?.[0].onPressMarket('BTC');
    });

    expect(selectMarketByCoin).toHaveBeenCalledWith('BTC');
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(scrollToOffset).toHaveBeenCalledWith({ animated: false, offset: 0 });
  });

  it('uses the preference owner rollback as the single source of list and tab state', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ activeInfoTab: 'openOrders' }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = screen.UNSAFE_getByType(FlatList);
    expect(
      screen.getByTestId('perps-pro-open-orders-controls'),
    ).toBeOnTheScreen();
    // Generation and persistence rollback are tested by the preference owner;
    // this scene must adopt its published value rather than retain another state.
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ activeInfoTab: 'positions' }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(
      screen.getByTestId('perps-pro-positions-controls'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-info-tab-positions').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(0);
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

    expect(screen.getByTestId('perps-pro-region-alert-overlay')).toBeTruthy();
    const readTranslateY = (style: unknown) => {
      const translateY = StyleSheet.flatten(style)?.transform?.[0]
        ?.translateY as unknown as number | { __getValue: () => number };
      return typeof translateY === 'number'
        ? translateY
        : translateY.__getValue();
    };
    const regionAlertStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-region-alert-overlay').props.style,
    );
    expect(regionAlertStyle).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      left: 0,
      right: 0,
      zIndex: 4,
    });
    // The alert collapses with the header from its natural position.
    expect(readTranslateY(regionAlertStyle)).toBe(56);
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
    expect(screen.getByTestId('trade-form')).toBeTruthy();
    expect(screen.getByTestId('pro-header').props).not.toHaveProperty(
      'showBottomDivider',
    );

    expect(screen.getByTestId('perps-region-alert').props.bottomSpacing).toBe(
      4,
    );
    expect(screen.getByTestId('perps-region-alert').props.topSpacing).toBe(8);
    const marketOverlayStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-overlay').props.style,
    );
    expect(marketOverlayStyle).toMatchObject({ height: 40 });
    // Market starts below the alert and pins at the alert's bottom edge.
    expect(readTranslateY(marketOverlayStyle)).toBe(120);
    fireEvent.press(screen.getByTestId('market-bar'));
    expect(mockMarketSelectorPresent).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('perps-region-alert'), 'layout', {
      nativeEvent: {
        layout: {
          height: 52.25,
          width: Dimensions.get('window').width - 32,
          x: 16,
          y: 56,
        },
      },
    });
    expect(
      readTranslateY(
        screen.getByTestId('perps-pro-market-overlay').props.style,
      ),
    ).toBe(121);
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
    expect(screen.getByTestId('pro-header').props).not.toHaveProperty(
      'showBottomDivider',
    );
    expect(screen.getByTestId('market-bar-skeleton')).toBeOnTheScreen();
    const marketOverlayStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-overlay').props.style,
    );
    const marketTranslateY = marketOverlayStyle?.transform?.[0]
      ?.translateY as unknown as number | { __getValue: () => number };
    expect(marketOverlayStyle).toMatchObject({ height: 40 });
    // header (56) + measured alert extent (8 + 34 + 4).
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
    expect(screen.getByTestId('perps-pro-info-tabs-overlay')).toBeTruthy();

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
    expect(marketOverlayStyle).toMatchObject({ height: 40 });
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
      if (event === 'change') {
        onAppStateChange = cb;
      }
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
      depositFromSwapVisible: false,
      mode: 'swap',
      sourceAsset: 'USDC',
      targetAsset: 'USDC',
    });
  });

  it('keeps Swap mounted while Deposit is topmost and restores Swap on Back', () => {
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

    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('account-asset-unified:0'));

    const swapProps = mockFundingOverlayProps.mock.lastCall?.[0] as {
      depositFromSwapVisible: boolean;
      mode: string;
      onOpenDeposit: () => void;
    };
    act(() => swapProps.onOpenDeposit());

    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      depositFromSwapVisible: true,
      mode: 'swap',
    });

    const {
      getTopPerpsProSheetNavigationRegistration,
      requestDismissPerpsProSheet,
    } =
      require('../components/common/perpsProSheetNavigationRegistry') as typeof import('../components/common/perpsProSheetNavigationRegistry');
    const nestedDeposit = getTopPerpsProSheetNavigationRegistration();
    expect(nestedDeposit).not.toBeNull();
    act(() => requestDismissPerpsProSheet(nestedDeposit!));

    expect(screen.getByTestId('funding-overlay')).toBeTruthy();
    expect(mockFundingOverlayProps.mock.lastCall?.[0]).toMatchObject({
      depositFromSwapVisible: false,
      mode: 'swap',
    });

    act(() => swapProps.onOpenDeposit());
    const staleNestedClose = mockFundingOverlayProps.mock.lastCall?.[0]
      .onCloseDeposit as () => void;
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ accountIdentity: 'account-b', accountState: 'ready' }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.queryByTestId('funding-overlay')).toBeNull();

    act(staleNestedClose);
    expect(screen.queryByTestId('funding-overlay')).toBeNull();
  });

  it('renders approved Position and Open Orders empty rows only for authoritative emptiness', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positionCollectionPresentation: 'authoritativeEmpty',
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-positions-empty-illustration'),
    ).toBeTruthy();
    expect(screen.getByText('page.perps.pro.positions.empty')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-positions-controls')).toBeNull();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        openOrderCollectionPresentation: 'authoritativeEmpty',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-open-orders-empty-illustration'),
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
        positionCollectionPresentation: 'filteredEmpty',
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
        openOrderCollectionPresentation: 'filteredEmpty',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.getByTestId('perps-pro-open-orders-controls')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-open-orders-empty')).toBeTruthy();
  });

  it('keeps collection controls visible without showing a false empty row while data is unresolved', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positionCollectionPresentation: 'unresolved',
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.getByTestId('perps-pro-positions-controls')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-positions-empty')).toBeNull();

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        openOrderCollectionPresentation: 'unresolved',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.getByTestId('perps-pro-open-orders-controls')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-open-orders-empty')).toBeNull();
  });

  it('routes Position and Open Orders filters to independent local state', () => {
    const setHideOtherPositionSymbols = jest.fn();
    const setHideOtherOpenOrderSymbols = jest.fn();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        hideOtherOpenOrderSymbols: false,
        hideOtherPositionSymbols: true,
        setHideOtherOpenOrderSymbols,
        setHideOtherPositionSymbols,
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const positionCheckbox = within(
      screen.getByTestId('perps-pro-positions-controls'),
    ).getByRole('checkbox');
    expect(positionCheckbox.props.accessibilityState).toEqual({
      checked: true,
    });
    fireEvent.press(positionCheckbox);
    expect(setHideOtherPositionSymbols).toHaveBeenCalledTimes(1);
    expect(setHideOtherOpenOrderSymbols).not.toHaveBeenCalled();
    expect(setHideOtherPositionSymbols.mock.calls[0][0](true)).toBe(false);

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        hideOtherOpenOrderSymbols: false,
        hideOtherPositionSymbols: true,
        setHideOtherOpenOrderSymbols,
        setHideOtherPositionSymbols,
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const openOrderCheckbox = within(
      screen.getByTestId('perps-pro-open-orders-controls'),
    ).getByRole('checkbox');
    expect(openOrderCheckbox.props.accessibilityState).toEqual({
      checked: false,
    });
    fireEvent.press(openOrderCheckbox);
    expect(setHideOtherOpenOrderSymbols).toHaveBeenCalledTimes(1);
    expect(setHideOtherPositionSymbols).toHaveBeenCalledTimes(1);
    expect(setHideOtherOpenOrderSymbols.mock.calls[0][0](false)).toBe(true);
  });

  it('uses unfiltered positions for visible Open Order edit context', () => {
    const position = {
      baseSize: '2',
      coin: 'ETH',
      direction: 'long',
      entryPrice: '3000',
      key: 'ETH',
    };
    const order = {
      category: 'conditional',
      coin: 'ETH',
      editKind: 'triggerMarket',
      isPositionTpsl: true,
      key: 'conditional-eth',
      oid: 7,
      reduceOnly: true,
      side: 'sell',
    };
    const open = jest.fn();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        allOpenOrdersCount: 1,
        allPositionsByCoin: new Map([['ETH', position]]),
        hideOtherOpenOrderSymbols: false,
        hideOtherPositionSymbols: true,
        openOrderCategory: 'conditional',
        openOrderCounts: { basic: 0, conditional: 1, unsupported: 0 },
        openOrders: [order],
        positions: [],
      }),
    );
    mockUsePerpsProOpenOrderEdit.mockReturnValue({
      close: jest.fn(),
      closeReview: jest.fn(),
      confirm: jest.fn(),
      editor: { category: 'conditional', order, position: null },
      isEditUnavailable: () => false,
      open,
      pending: false,
      requestBasicReview: jest.fn(),
      requestConditionalReview: jest.fn(),
      review: null,
      skipConfirmation: false,
      toggleSkipConfirmation: jest.fn(),
    });

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    const openOrderCardProps = mockOpenOrderCardProps.mock.lastCall?.[0];
    act(() => openOrderCardProps.onEdit(order));
    expect(open).toHaveBeenCalledWith(order, position);
    expect(mockConditionalOrderEditSheetProps.mock.lastCall?.[0]).toMatchObject(
      { position },
    );
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
    const scroll = screen.getByTestId('perps-pro-info-list');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 700, width: 393, x: 0, y: 0 } },
    });

    expect(
      StyleSheet.flatten(scroll.props.contentContainerStyle),
    ).toMatchObject({ minHeight: 1202, paddingBottom: 386 });

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
        screen.getByTestId('perps-pro-info-list').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1202, paddingBottom: 386 });

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
        screen.getByTestId('perps-pro-info-list').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1202, paddingBottom: 386 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positionCollectionPresentation: 'authoritativeEmpty',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-info-list').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1202, paddingBottom: 32 });

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
        screen.getByTestId('perps-pro-info-list').props.contentContainerStyle,
      ),
    ).toMatchObject({ minHeight: 1202, paddingBottom: 32 });
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
