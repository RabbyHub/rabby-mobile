import {
  act,
  fireEvent,
  render as renderNative,
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
import type { L2Book, WsActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import {
  nativeBoundary,
  type PanBoundary,
  type PanEvent,
} from '@/testUtils/linkedPagerNativeBoundary';

let mockIsLight = true;
const mockUsePerpsProScene = jest.fn();
const mockUsePerpsProInfoPanel = jest.fn();
const mockMarketSelectorPresent = jest.fn();
const mockMarketSelectorMount = jest.fn();
const mockMarketSelectorUnmount = jest.fn();
const mockOrderBookRender = jest.fn();
const mockOrderBookProps = jest.fn();
const mockTradeFormProps = jest.fn();
const mockTradeHookProps = jest.fn();
const mockOrderConfirmationProps = jest.fn();
const mockGetActiveAssetData = jest.fn();
const mockLeverageUpdateProps = jest.fn();
const mockAssetSubscriptions: {
  callback: (data: WsActiveAssetData) => void;
  coin: string;
  address: string;
  unsubscribe: jest.Mock;
}[] = [];
const mockUpdateLeverage = jest.fn(async () => true);
const mockBboSubscriptions: {
  callback: (book: L2Book) => void;
  coin: string;
  unsubscribe: jest.Mock;
}[] = [];
const mockBboWs = {
  on: jest.fn(),
  off: jest.fn(),
  subscribeToActiveAssetCtx: jest.fn(),
  subscribeToActiveAssetData: jest.fn(
    (
      coin: string,
      address: string,
      callback: (data: WsActiveAssetData) => void,
    ) => {
      const unsubscribe = jest.fn();
      mockAssetSubscriptions.push({ callback, coin, address, unsubscribe });
      return { unsubscribe };
    },
  ),
  subscribeToL2Book: jest.fn(
    ({ coin }: { coin: string }, callback: (book: L2Book) => void) => {
      const unsubscribe = jest.fn();
      mockBboSubscriptions.push({ callback, coin, unsubscribe });
      return { unsubscribe };
    },
  ),
};
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
let mockOrderPending = false;
const mockIsOrderPending = () => mockOrderPending;
const mockManageMarginOpen = jest.fn();
const mockTransferOpen = jest.fn();
const mockTranslate = (key: string) => key;
const mockKlineProps = jest.fn();
const mockKlineMount = jest.fn();
const mockKlineUnmount = jest.fn();
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
const mockSetPage = jest.fn();
const mockPageCommands = jest.fn();
let mockTradeAmountUnit: 'base' | 'quote' = 'quote';
let mockLeveragePending = false;
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
  const ReactNative = require('react-native');
  const boundary =
    require('@/testUtils/linkedPagerNativeBoundary').createReanimatedBoundary();
  return {
    ...boundary,
    default: { ...boundary.default, Text: ReactNative.Text },
    Easing: { ...boundary.Easing, bezier: jest.fn(() => 'ease-out') },
    dispatchCommand: (
      ref: { current: Record<string, (...args: unknown[]) => void> },
      name: string,
      args: unknown[],
    ) => ref.current[name](...args),
    ReduceMotion: { System: 'system' },
    useDerivedValue: (factory: () => unknown) => ({
      value: factory(),
    }),
    useScrollViewOffset: (_ref: unknown, offset: unknown) => offset,
    withDecay: jest.fn(({ velocity }: { velocity: number }) => velocity),
  };
});

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (props: { testID?: string }, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(
          ref,
          () => ({
            setPage: (index: number) => {
              mockSetPage(index);
              mockPageCommands(props.testID, index);
            },
          }),
          [props.testID],
        );
        return ReactModule.createElement(View, props);
      },
    ),
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

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    currentPerpsAccount: null,
    hasPermission: true,
  })),
}));

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      ws: mockBboWs,
      info: { getActiveAssetData: mockGetActiveAssetData },
    }),
  },
}));

jest.mock('./usePerpsProTradePreferences', () => ({
  usePerpsProTradeAmountUnit: () => mockTradeAmountUnit,
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
  const ReactModule = require('react');
  const boundary =
    require('@/testUtils/linkedPagerNativeBoundary').createGestureBoundary();
  return {
    Pressable: require('react-native').Pressable,
    Gesture: {
      Pan: boundary.Gesture.Pan,
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
    GestureDetector: (
      props: React.PropsWithChildren<{ gesture: PanBoundary }>,
    ) =>
      props.gesture.config
        ? ReactModule.createElement(boundary.GestureDetector, props)
        : props.children,
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

jest.mock('@/hooks/theme', () => {
  const ReactModule = jest.requireActual('react');
  const colors2024 = new Proxy(
    {},
    {
      get: (_target, key) => String(key),
    },
  );
  return {
    useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
      const isLight = mockIsLight;
      // Match the real hook's stable styles until the theme inputs change.
      const styles = ReactModule.useMemo(
        () => getStyle({ colors2024, isLight }),
        [getStyle, isLight],
      );
      return { colors2024, isLight, styles };
    },
  };
});

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
      ReactModule.useEffect(() => {
        mockKlineMount();
        return mockKlineUnmount;
      }, []);
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
      (props: { onClose?: () => void }, ref: React.Ref<unknown>) => {
        ReactModule.useEffect(() => {
          mockMarketSelectorMount();
          return mockMarketSelectorUnmount;
        }, []);
        ReactModule.useImperativeHandle(ref, () => ({
          present: mockMarketSelectorPresent,
        }));
        return ReactModule.createElement(View, {
          onDismiss: props.onClose,
          testID: 'market-selector',
        });
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
  PerpsProOrderConfirmationSheet: (props: object) => {
    mockOrderConfirmationProps(props);
    return null;
  },
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

// This suite owns scene/list wiring; live market subscription contracts are
// covered with the real hook in its own and TradePanelOwner's tests.
jest.mock('./usePerpsProLiveMarket', () => ({
  usePerpsProLiveMarket: (coin: string) => {
    const market =
      mockUsePerpsProScene.mock.results.at(-1)?.value?.currentMarket;
    return coin && market?.canonicalCoin === coin ? market : null;
  },
}));

jest.mock('./usePerpsProTrade', () => ({
  usePerpsProTrade: (props: { market: unknown }) => {
    mockTradeHookProps(props);
    return {
      amountUnit: mockTradeAmountUnit,
      closeReview: jest.fn(),
      confirmReview: jest.fn(),
      form: mockTradeForm,
      getOrderBookPriceIntent: () => mockGetOrderBookPriceIntent(),
      leverage: 1,
      marginMode: 'isolated',
      market: props.market,
      pending: false,
      review: null,
      selectOrderBookPrice: (...args: unknown[]) =>
        mockSelectOrderBookPrice(...args),
      setPrice: jest.fn(),
      setSkipConfirmation: jest.fn(),
      skipConfirmation: false,
      tpSl: { focusedLeg: mockTradeFocusedLeg },
    };
  },
}));

jest.mock('./usePerpsProLeverageUpdate', () => ({
  usePerpsProLeverageUpdate: (props: object) => {
    mockLeverageUpdateProps(props);
    return {
      pending: mockLeveragePending,
      update: mockUpdateLeverage,
    };
  },
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
const { PerpsProAccountPresentationReset } =
  require('./PerpsProAccountPresentationReset') as typeof import('./PerpsProAccountPresentationReset');
const { perpsStore: mockPerpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const { PerpsProTabIndicator } =
  require('../components/common/PerpsProTabIndicator') as typeof import('../components/common/PerpsProTabIndicator');
const { PerpsProInfoSingleList } =
  require('../components/info/PerpsProInfoSingleList') as typeof import('../components/info/PerpsProInfoSingleList');
const { LinkedScenePager } =
  require('@rabby-wallet/rn-collapsible-scene-view/src/LinkedScenePager') as typeof import('@rabby-wallet/rn-collapsible-scene-view/src/LinkedScenePager');
const { buildLinkedSceneModel } =
  require('@rabby-wallet/rn-collapsible-scene-view/src/linkedSceneModel') as typeof import('@rabby-wallet/rn-collapsible-scene-view/src/linkedSceneModel');
const { CollapsibleHeaderLayer, CollapsiblePinnedLayer, SceneList } =
  require('@rabby-wallet/rn-collapsible-scene-view') as typeof import('@rabby-wallet/rn-collapsible-scene-view');
const { scrollPerpsProTradeAboveKeyboard } =
  require('../components/common/perpsProKeyboardSession') as typeof import('../components/common/perpsProKeyboardSession');
const tradeDisplayVisibility =
  require('./usePerpsProTradeDisplayVisibility') as typeof import('./usePerpsProTradeDisplayVisibility');

const createSceneState = (overrides: Record<string, unknown> = {}) => ({
  accountLeverageConfiguration: null,
  cancelPendingMarketSelection: jest.fn(),
  currentMarket: null,
  executionActive: false,
  fundingHistoryEnabled: true,
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
  const openOrderCategory = (overrides.openOrderCategory ?? 'basic') as
    | 'basic'
    | 'conditional';
  const openOrderCollectionPresentation =
    overrides.openOrderCollectionPresentation ??
    (openOrders.length > 0 ? 'populated' : 'unresolved');
  const otherPresentation =
    openOrderCollectionPresentation === 'populated'
      ? 'filteredEmpty'
      : openOrderCollectionPresentation;
  const openOrdersByCategory = overrides.openOrdersByCategory ?? {
    basic: openOrderCategory === 'basic' ? openOrders : [],
    conditional: openOrderCategory === 'conditional' ? openOrders : [],
  };
  const openOrderCollectionPresentationByCategory =
    overrides.openOrderCollectionPresentationByCategory ?? {
      basic:
        openOrderCategory === 'basic'
          ? openOrderCollectionPresentation
          : otherPresentation,
      conditional:
        openOrderCategory === 'conditional'
          ? openOrderCollectionPresentation
          : otherPresentation,
    };
  const positions = (overrides.positions ?? []) as unknown[];
  // This suite isolates Scene composition. The real selector/store/activity
  // contract is exercised in usePerpsProInfoPanel.integration.test.tsx.
  const account = (overrides.account ?? {
    assets: [],
    mode: 'standard',
  }) as {
    assets: { coin: string; key: string }[];
    mode: string;
    primaryValue?: string;
    unrealizedPnl?: string;
  };
  const accountControl = {
    mode: account.mode,
    marginRatio: null,
    hasUnresolvedDexes: false,
    hasUnpricedNonZeroAssets: false,
  };
  const accountAssetKeys = account.assets.map(asset => asset.key);
  const summary = {
    primaryValue: account.primaryValue ?? '0',
    unrealizedPnl: account.unrealizedPnl ?? '0',
  };
  const accountSelectors = {
    control: () => accountControl,
    assetKeys: () => accountAssetKeys,
    valuation: () => account,
    summary: () => summary,
  };
  return {
    account,
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
    openOrderCategory,
    openOrderCollectionPresentation,
    openOrderCollectionPresentationByCategory,
    openOrdersByCategory,
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
    accountControl,
    accountAssetKeys,
    accountSelectors,
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
    const [openOrderCategory, setOpenOrderCategory] = React.useState<
      'basic' | 'conditional'
    >(overrides.openOrderCategory === 'conditional' ? 'conditional' : 'basic');
    return createInfoState({
      ...overrides,
      activeInfoTab,
      openOrderCategory,
      setOpenOrderCategory,
      setActiveInfoTab: (tab: typeof activeInfoTab) => {
        setActiveInfoTab(tab);
        persist(tab);
      },
    });
  });
  return persist;
};

type InfoTab = 'positions' | 'openOrders' | 'account';
const infoTabs: readonly InfoTab[] = ['positions', 'openOrders', 'account'];
const getInfoList = (tab?: InfoTab) => {
  const testID =
    tab === 'openOrders'
      ? `perps-pro-open-orders-rows-${
          screen.UNSAFE_getByType(PerpsProInfoSingleList).props.openOrders
            .controls.category
        }`
      : tab
      ? `perps-pro-info-list-rows-${tab}`
      : 'perps-pro-info-list';
  const list = screen
    .UNSAFE_getAllByType(FlatList)
    .find(node => node.props.testID === testID);
  if (!list) {
    throw new Error(`Missing list ${testID}`);
  }
  return list;
};
const INFO_TRACK_WIDTH = 400;
const getInfoTrack = () => screen.getByTestId('perps-pro-info-list-root-track');
const getInfoModel = () =>
  buildLinkedSceneModel(screen.UNSAFE_getByType(LinkedScenePager).props.pages);
const getInfoLeaf = (tab: InfoTab, category?: 'basic' | 'conditional') => {
  const model = getInfoModel();
  const categoryKey =
    category ??
    screen.UNSAFE_getByType(PerpsProInfoSingleList).props.openOrders.controls
      .category;
  return model.leaves.find(
    leaf =>
      leaf.path.key === tab &&
      (leaf.path.childKey === undefined || leaf.path.childKey === categoryKey),
  )!;
};
const getInfoPage = (tab: InfoTab, category?: 'basic' | 'conditional') =>
  screen.getByTestId(
    `perps-pro-info-list-page-${getInfoLeaf(tab, category).physicalKey}`,
    {
      includeHiddenElements: true,
    },
  );
const layoutInfoTrack = () => {
  const layout = screen.queryByTestId('perps-pro-info-list-layout');
  if (!layout) {
    return;
  }
  fireEvent(layout, 'layout', {
    nativeEvent: {
      layout: { width: INFO_TRACK_WIDTH, height: 600, x: 0, y: 0 },
    },
  });
};
const render = (element: React.ReactElement) => {
  const result = renderNative(element);
  layoutInfoTrack();
  return {
    ...result,
    rerender: (next: React.ReactElement) => {
      result.rerender(next);
      layoutInfoTrack();
    },
  };
};
const infoPan = () =>
  screen.getByTestId('perps-pro-info-list-pan').props.gesture as PanBoundary;
const panEvent = (translationX = 0): PanEvent => ({
  translationX,
  translationY: 0,
  velocityX: 0,
  x: 200,
  y: 200,
  absoluteX: 200,
  absoluteY: 200,
});
let swipe: { pan: PanBoundary; start: number; progress: number } | undefined;
const beginSwipe = () => {
  const path = screen.UNSAFE_getByType(LinkedScenePager).props.activePath;
  const start = getInfoModel().leaves.find(
    leaf => leaf.path.key === path.key && leaf.path.childKey === path.childKey,
  )!.index;
  const pan = infoPan();
  swipe = { pan, start, progress: start };
  act(() => {
    pan.touchesDown?.(
      { numberOfTouches: 1, allTouches: [{ x: 200, y: 200 }] },
      { fail: jest.fn(), activate: jest.fn(), end: jest.fn() },
    );
    pan.handlers.onStart?.(panEvent());
  });
};
const physicalPageScroll = (progress: number) => {
  if (swipe) {
    swipe.progress = progress;
    const { pan, start } = swipe;
    act(() =>
      pan.handlers.onUpdate(panEvent((start - progress) * INFO_TRACK_WIDTH)),
    );
  } else if (nativeBoundary.animations().length) {
    // Advance the actual UI animation without invoking its completion.
    act(() => nativeBoundary.advanceAnimations(0.8));
  }
};
const finishPhysicalPage = (_progress?: number) => {
  if (swipe) {
    const { pan, start, progress } = swipe;
    swipe = undefined;
    act(() => {
      const event = panEvent((start - progress) * INFO_TRACK_WIDTH);
      pan.handlers.onEnd(event, true);
      pan.handlers.onFinalize?.(event, true);
    });
  }
  if (nativeBoundary.animations().length) {
    act(() => nativeBoundary.finishNextAnimation());
  }
};
// Legacy outer-tab assertions use logical positions. Map only their event
// coordinates onto the declared leaves; no production state is assigned.
const logicalProgressToPhysical = (progress: number) => {
  const model = getInfoModel();
  const lower = Math.max(0, Math.min(2, Math.floor(progress)));
  const upper = Math.min(2, lower + 1);
  const from = model.roots[lower].lastLeafIndex;
  const to = model.roots[upper].firstLeafIndex;
  return from + (to - from) * (progress - lower);
};
const pageState = (state: 'dragging' | 'settling' | 'idle') => {
  if (state === 'dragging') {
    beginSwipe();
  } else if (state === 'idle') {
    finishPhysicalPage();
  }
};
const pageScroll = (position: number, offset: number) =>
  physicalPageScroll(logicalProgressToPhysical(position + offset));
const settleInfoPage = (tab: InfoTab) => {
  const position = getInfoLeaf(tab).index;
  physicalPageScroll(position);
  finishPhysicalPage(position);
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

let assetFixtureId = 0;
const createActiveAssetData = (
  coin: string,
  user: string,
): WsActiveAssetData => ({
  availableToTrade: ['100', '100'],
  coin,
  leverage: { type: 'cross', value: 10 },
  markPx: '100',
  maxTradeSzs: ['100', '100'],
  user,
});

describe('PerpsProScene market loading states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nativeBoundary.reset();
    swipe = undefined;
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
    mockPerpsStore.setState({ currentPerpsAccount: null, hasPermission: true });
    mockAssetSubscriptions.length = 0;
    mockGetActiveAssetData.mockReset();
    mockGetActiveAssetData.mockImplementation(async (coin, address) =>
      createActiveAssetData(coin, address),
    );
    mockTradeAmountUnit = 'quote';
    mockOrderPending = false;
    mockLeveragePending = false;
    mockBboSubscriptions.length = 0;
    mockTradeFocusedLeg = null;
    mockOrderBookPriceIntent = { type: 'tradePrice' };
    mockOrderBookSelectionOutcome = 'accepted';
    mockTradeForm = { bboEnabled: false, orderType: 'market' };
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

  it('protects only the linked cell and pinned tabs, leaving the trade header outside', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const lower = screen.getByTestId('perps-pro-info-list-root-gesture-block');
    expect(
      lower.findAllByProps({ testID: 'perps-pro-list-lead-in' }),
    ).toHaveLength(0);
    expect(
      lower.findAllByProps({ testID: 'perps-pro-trade-section' }),
    ).toHaveLength(0);
    expect(
      lower.findAllByProps({ testID: 'perps-pro-info-list-viewport' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByTestId('perps-pro-info-tabs-overlay')
        .findAllByProps({ testID: 'perps-pro-tabs-root-gesture-block' }).length,
    ).toBeGreaterThan(0);
  });

  it('keeps the list mounted but releases scene sheet hosts when a sibling root is active', () => {
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
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const list = getInfoList();
    expect(view.queryByTestId('market-selector')).toBeNull();
    fireEvent.press(view.getByTestId('market-bar'));
    expect(view.getByTestId('market-selector')).toBeTruthy();
    view.rerender(<PerpsProScene {...props} sceneActive={false} />);
    expect(mockUsePerpsProScene).toHaveBeenLastCalledWith(false);
    expect(getInfoList()).toBe(list);
    expect(view.queryByTestId('market-selector')).toBeNull();
    expect(view.queryByTestId('trade-form')).toBeTruthy();
    expect(mockTradeFormProps.mock.lastCall?.[0].sceneActive).toBe(false);
  });

  it('contains real BBO publications in the trade owner without rerendering Scene or its list', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        executionActive: true,
        realtimeEnabled: true,
        tradeConfigurationReady: true,
      }),
    );
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = getInfoList();
    const originalListProps = list.props;
    const originalHeader = screen.getByTestId('perps-pro-list-lead-in').props;
    const sceneRenders = mockUsePerpsProScene.mock.calls.length;
    const tradeRenders = mockTradeHookProps.mock.calls.length;
    expect(mockBboSubscriptions).toHaveLength(1);

    const book: L2Book = {
      coin: 'BTC',
      levels: [[{ n: 1, px: '99', sz: '1' }], [{ n: 1, px: '101', sz: '1' }]],
      time: 1,
    };
    act(() => mockBboSubscriptions[0].callback(book));

    expect(mockTradeHookProps.mock.calls.length).toBeGreaterThan(tradeRenders);
    expect(mockTradeHookProps.mock.lastCall?.[0]).toMatchObject({
      bboBook: book,
      bboPrices: { asks1: '101', bids1: '99' },
      bboStatus: 'ready',
    });
    expect(mockUsePerpsProScene).toHaveBeenCalledTimes(sceneRenders);
    expect(getInfoList()).toBe(list);
    expect(list.props).toBe(originalListProps);
    expect(screen.getByTestId('perps-pro-list-lead-in').props).toBe(
      originalHeader,
    );
  });

  it('contains one real active-asset feed in the trade owner without rerendering Scene or its list', () => {
    const address = `0x${String(++assetFixtureId).padStart(40, '0')}`;
    mockPerpsStore.setState({
      currentPerpsAccount: { address } as never,
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
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = getInfoList();
    const listProps = list.props;
    const headerProps = screen.getByTestId('perps-pro-list-lead-in').props;
    const sceneRenders = mockUsePerpsProScene.mock.calls.length;
    const leverageRenders = mockLeverageUpdateProps.mock.calls.length;
    const tradeRenders = mockTradeHookProps.mock.calls.length;
    expect(mockAssetSubscriptions).toHaveLength(1);
    expect(mockBboWs.subscribeToActiveAssetCtx).not.toHaveBeenCalled();
    expect(leverageRenders).toBe(sceneRenders);

    const data = createActiveAssetData('BTC', address);
    act(() => mockAssetSubscriptions[0].callback(data));
    expect(mockTradeHookProps.mock.calls.length).toBeGreaterThan(tradeRenders);
    expect(mockTradeHookProps.mock.lastCall?.[0].activeAssetData).toBe(data);
    expect(mockUsePerpsProScene).toHaveBeenCalledTimes(sceneRenders);
    expect(mockLeverageUpdateProps).toHaveBeenCalledTimes(leverageRenders);
    expect(getInfoList()).toBe(list);
    expect(list.props).toBe(listProps);
    expect(screen.getByTestId('perps-pro-list-lead-in').props).toBe(
      headerProps,
    );
    expect(mockAssetSubscriptions).toHaveLength(1);
    view.unmount();
    expect(mockAssetSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps the shared leverage refresh stable while reading the current owner handle and scope', async () => {
    const address = `0x${String(++assetFixtureId).padStart(40, '0')}`;
    mockPerpsStore.setState({ currentPerpsAccount: { address } as never });
    const sceneForCoin = (coin: string) =>
      createSceneState({
        currentMarket: {
          canonicalCoin: coin,
          marketKey: `hyperliquid::${coin}`,
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        klineEnabled: true,
      });
    mockUsePerpsProScene.mockReturnValue(sceneForCoin('BTC'));
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const refresh: () => Promise<unknown> =
      mockLeverageUpdateProps.mock.lastCall?.[0].refreshActiveAssetData;
    const localRefresh =
      mockTradeHookProps.mock.lastCall?.[0].refreshActiveAssetData;
    expect(refresh).not.toBe(localRefresh);
    await act(async () => {
      await expect(refresh()).resolves.toEqual(
        createActiveAssetData('BTC', address),
      );
    });
    expect(mockGetActiveAssetData).toHaveBeenLastCalledWith('BTC', address);

    mockUsePerpsProScene.mockReturnValue(sceneForCoin('ETH'));
    view.rerender(<PerpsProScene {...props} />);
    expect(
      mockLeverageUpdateProps.mock.lastCall?.[0].refreshActiveAssetData,
    ).toBe(refresh);
    expect(mockTradeHookProps.mock.lastCall?.[0].refreshActiveAssetData).toBe(
      localRefresh,
    );
    const sceneRenders = mockUsePerpsProScene.mock.calls.length;
    const nextAddress = `0x${String(++assetFixtureId).padStart(40, '0')}`;
    act(() => {
      mockPerpsStore.setState({
        currentPerpsAccount: { address: nextAddress } as never,
      });
    });
    expect(mockUsePerpsProScene).toHaveBeenCalledTimes(sceneRenders);
    await act(async () => {
      await expect(refresh()).resolves.toEqual(
        createActiveAssetData('ETH', nextAddress),
      );
    });
    expect(mockGetActiveAssetData).toHaveBeenLastCalledWith('ETH', nextAddress);
    expect(mockAssetSubscriptions).toHaveLength(3);
    expect(mockLeverageUpdateProps).toHaveBeenCalledTimes(sceneRenders);
    view.unmount();
    await expect(refresh()).resolves.toBeNull();
    expect(mockGetActiveAssetData).toHaveBeenCalledTimes(2);
  });

  it('keeps the trade owner alive before preference hydration and across tab switches', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          canonicalCoin: 'BTC',
          marketKey: 'hyperliquid::BTC',
          marketData: { maxLeverage: 40, onlyIsolated: false },
          quoteAsset: 'USDC',
        },
        realtimeEnabled: true,
        tradeConfigurationReady: true,
      }),
    );
    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({ activeInfoTab: null }),
    );
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    expect(screen.queryByTestId('perps-pro-info-list')).toBeNull();
    expect(mockBboSubscriptions).toHaveLength(1);
    expect(mockTradeHookProps).toHaveBeenCalled();
    expect(mockOrderConfirmationProps).toHaveBeenCalled();

    for (const activeInfoTab of ['positions', 'account', 'openOrders']) {
      mockUsePerpsProInfoPanel.mockReturnValue(
        createInfoState({ activeInfoTab }),
      );
      view.rerender(<PerpsProScene {...props} />);
      settleInfoPage(activeInfoTab as InfoTab);
      expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
    }
    expect(mockBboSubscriptions).toHaveLength(1);
    expect(mockBboSubscriptions[0].unsubscribe).not.toHaveBeenCalled();
  });

  it('shares the same leverage request lock with the trade and position owners', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    for (const pending of [false, true, false]) {
      mockLeveragePending = pending;
      view.rerender(<PerpsProScene {...props} />);
      expect(mockUsePerpsProPositionActions.mock.lastCall?.[0]).toMatchObject({
        leveragePending: pending,
        updateLeverageRequest: mockUpdateLeverage,
      });
      expect(mockTradeHookProps.mock.lastCall?.[0]).toMatchObject({
        leveragePending: pending,
        refreshActiveAssetData: expect.any(Function),
        updateLeverageRequest: mockUpdateLeverage,
      });
      expect(mockLeverageUpdateProps).toHaveBeenCalledTimes(
        mockUsePerpsProScene.mock.calls.length,
      );
    }
  });

  it('observes permission changes directly without waiting for a trade publication', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.queryByTestId('perps-region-alert')).toBeNull();
    act(() => mockPerpsStore.setState({ hasPermission: false }));
    expect(screen.getByTestId('perps-region-alert')).toBeOnTheScreen();
    act(() => mockPerpsStore.setState({ hasPermission: true }));
    expect(screen.queryByTestId('perps-region-alert')).toBeNull();
  });

  it('keeps row rendering stable for unrelated scene and info-wrapper updates', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    const info = createInfoState({ activeInfoTab: 'positions' });
    mockUsePerpsProInfoPanel.mockReturnValue(info);
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const firstRenderer = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .renderItemByTab.positions;

    // Hooks can return a new wrapper while all row-relevant facts stay equal.
    mockUsePerpsProInfoPanel.mockReturnValue({
      ...info,
      pendingFundingCount: 1,
    });
    view.rerender(<PerpsProScene {...props} />);
    expect(
      screen.UNSAFE_getByType(PerpsProInfoSingleList).props.renderItemByTab
        .positions,
    ).toBe(firstRenderer);

    mockUsePerpsProInfoPanel.mockReturnValue({
      ...info,
      hideOtherPositionSymbols: true,
    });
    view.rerender(<PerpsProScene {...props} />);
    expect(
      screen.UNSAFE_getByType(PerpsProInfoSingleList).props.renderItemByTab
        .positions,
    ).not.toBe(firstRenderer);
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
  });

  it.each(['positions', 'openOrders'] as const)(
    'keeps the active %s list unchanged by Account valuation and catches up when selected',
    activeInfoTab => {
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      const info = createInfoState({
        activeInfoTab,
        accountState: 'ready',
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
          primaryValue: '100',
          titleKey: 'perpsAccountSummary',
          unrealizedPnl: '0',
        },
      });
      mockUsePerpsProInfoPanel.mockReturnValue(info);
      const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
      const view = render(<PerpsProScene {...props} />);
      const list = getInfoList(activeInfoTab);
      const originalListProps = list.props;
      const originalPage = screen.UNSAFE_getByType(
        PerpsProInfoSingleList,
      ).props;
      const updated = createInfoState({
        ...info,
        account: {
          ...info.account,
          assets: [...info.account.assets],
          primaryValue: '123',
        },
      });
      mockUsePerpsProInfoPanel.mockReturnValue(updated);
      view.rerender(<PerpsProScene {...props} />);
      const page = screen.UNSAFE_getByType(PerpsProInfoSingleList).props;
      expect(page.rowsByTab[activeInfoTab]).toBe(
        originalPage.rowsByTab[activeInfoTab],
      );
      expect(page.renderItemByTab[activeInfoTab]).toBe(
        originalPage.renderItemByTab[activeInfoTab],
      );
      expect(page.renderItemByTab.account).not.toBe(
        originalPage.renderItemByTab.account,
      );
      expect(getInfoList(activeInfoTab)).toBe(list);
      expect(Object.is(list.props, originalListProps)).toBe(true);

      mockUsePerpsProInfoPanel.mockReturnValue({
        ...updated,
        activeInfoTab: 'account',
      });
      view.rerender(<PerpsProScene {...props} />);
      settleInfoPage('account');
      expect(getInfoList(activeInfoTab)).toBe(list);
      expect(
        screen.getByTestId('perps-pro-account-portfolio-value').props.children,
      ).toBe('$123.00');
    },
  );

  it('keeps the active Account list unchanged by position-only data while preserving the latest tab rows', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    const info = createInfoState({ activeInfoTab: 'account' });
    mockUsePerpsProInfoPanel.mockReturnValue(info);
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const list = getInfoList('account');
    const originalProps = list.props;
    const updated = {
      ...info,
      positions: [{ key: 'BTC', coin: 'BTC' }],
      allPositionsCount: 1,
      positionCollectionPresentation: 'populated',
    };
    mockUsePerpsProInfoPanel.mockReturnValue(updated);
    view.rerender(<PerpsProScene {...props} />);
    // A collection becoming populated also changes the other tab's content
    // padding. Its current-tab style must remain independent.
    expect(list.props.data).toBe(originalProps.data);
    expect(list.props.renderItem).toBe(originalProps.renderItem);
    expect(Object.is(list.props, originalProps)).toBe(true);
    mockUsePerpsProInfoPanel.mockReturnValue({
      ...updated,
      activeInfoTab: 'positions',
    });
    view.rerender(<PerpsProScene {...props} />);
    settleInfoPage('positions');
    expect(screen.getByTestId('position-card')).toBeTruthy();
    expect(getInfoList('account')).toBe(list);
  });

  it.each(['positions', 'openOrders'] as const)(
    'keeps %s placeholder data stable across fresh empty poll responses',
    activeInfoTab => {
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      const info = createInfoState({
        activeInfoTab,
        positions: [],
        openOrders: [],
        positionCollectionPresentation: 'authoritativeEmpty',
        openOrderCollectionPresentation: 'authoritativeEmpty',
      });
      mockUsePerpsProInfoPanel.mockReturnValue(info);
      const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
      const view = render(<PerpsProScene {...props} />);
      const list = getInfoList(activeInfoTab);
      const verticalOwner = getInfoList();
      const originalData = list.props.data;
      mockUsePerpsProInfoPanel.mockReturnValue({
        ...info,
        positions: [],
        openOrders: [],
      });
      view.rerender(<PerpsProScene {...props} />);
      expect(list.props.data).toBe(originalData);

      mockUsePerpsProInfoPanel.mockReturnValue({
        ...info,
        positionCollectionPresentation: 'populated',
        openOrderCollectionPresentation: 'populated',
        openOrderCollectionPresentationByCategory: {
          basic: 'populated',
          conditional: 'filteredEmpty',
        },
        positions: [{ key: 'BTC', coin: 'BTC' }],
        openOrders: [{ key: 'order-1', coin: 'BTC' }],
        openOrdersByCategory: {
          basic: [{ key: 'order-1', coin: 'BTC' }],
          conditional: [],
        },
      });
      view.rerender(<PerpsProScene {...props} />);
      expect(getInfoList(activeInfoTab).props.data).not.toBe(originalData);
      expect(
        screen.getByTestId(
          activeInfoTab === 'positions' ? 'position-card' : 'open-order-card',
        ),
      ).toBeTruthy();
      // Adding the two category leaves replaces the horizontal topology, but
      // must never replace the only native vertical owner.
      expect(getInfoList()).toBe(verticalOwner);
    },
  );

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

  it('mounts the retained pages for the resolved tab without exposing inactive rows', () => {
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
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
    expect(screen.getByTestId('perps-pro-trade-section')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-positions-controls')).toBeTruthy();
    expect(screen.queryByTestId('account-skeleton')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-info-tab-positions').props
        .accessibilityState,
    ).toEqual({ selected: true });
  });

  it('keeps trade and header outside the UI horizontal track', () => {
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const pager = getInfoTrack();
    expect(within(pager).queryByTestId('perps-pro-trade-section')).toBeNull();
    expect(within(pager).queryByTestId('perps-pro-list-lead-in')).toBeNull();
    expect(
      within(screen.getByTestId('perps-pro-info-list')).getByTestId(
        'perps-pro-trade-section',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('perps-pro-info-list-pan')).toBeOnTheScreen();
    expect(pager.props.horizontal).toBeUndefined();
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

  it.each([false, true])(
    'shares one stable native clock across list, pins, and reset (Root-owned: %s)',
    sharedHeader => {
      installOptimisticInfoPanelMock();
      mockPerpsStore.setState({ hasPermission: false });
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      const sharedHeaderNativeScrollY = sharedHeader
        ? new NativeAnimated.Value(0)
        : undefined;
      render(
        <PerpsProScene
          sharedHeaderNativeScrollY={sharedHeaderNativeScrollY}
          initialRegionAlertLayout={{
            height: 52,
            width: Dimensions.get('window').width - 32,
          }}
          isModeSwitching={false}
          onSwitchToSimple={jest.fn()}
        />,
      );

      const nativeScrollY = screen.UNSAFE_getByType(PerpsProInfoSingleList)
        .props.nativeScrollY;
      expect(nativeScrollY).toBeInstanceOf(NativeAnimated.Value);
      if (sharedHeader) {
        expect(nativeScrollY).toBe(sharedHeaderNativeScrollY);
        expect(screen.queryByTestId('perps-pro-header-overlay')).toBeNull();
        expect(
          screen.UNSAFE_queryAllByType(CollapsibleHeaderLayer),
        ).toHaveLength(0);
      } else {
        expect(
          screen.getByTestId('perps-pro-header-overlay'),
        ).toBeOnTheScreen();
      }
      expect(
        screen.UNSAFE_getByType(PerpsProAccountPresentationReset).props
          .nativeScrollY,
      ).toBe(nativeScrollY);
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
        ...screen.UNSAFE_queryAllByType(CollapsibleHeaderLayer),
        ...pinnedLayers,
      ]) {
        expect(layer.props.nativeScrollY).toBe(nativeScrollY);
      }

      fireEvent.press(screen.getByTestId('perps-pro-info-tab-positions'));
      settleInfoPage('positions');

      expect(screen.UNSAFE_getByType(SceneList).props.nativeScrollY).toBe(
        nativeScrollY,
      );
      expect(
        screen.UNSAFE_getByType(PerpsProInfoSingleList).props.nativeScrollY,
      ).toBe(nativeScrollY);
      for (const layer of [
        ...screen.UNSAFE_queryAllByType(CollapsibleHeaderLayer),
        ...screen.UNSAFE_getAllByType(CollapsiblePinnedLayer),
      ]) {
        expect(layer.props.nativeScrollY).toBe(nativeScrollY);
      }
    },
  );

  // Component wiring only: apply the real geometry predicate at a fixed deep
  // offset. This does not exercise native measurement or the UI-thread mapper.
  it('keeps order book publication permissive until current-width trade geometry is measured', () => {
    const visibility = jest
      .spyOn(tradeDisplayVisibility, 'usePerpsProTradeDisplayVisibility')
      .mockImplementation(input =>
        tradeDisplayVisibility.isPerpsProTradeDisplayVisible({
          ...input,
          scrollY: 10_000,
        }),
      );
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
      }),
    );
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const width = Dimensions.get('window').width;
    const scrollOffset = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .scrollOffset;
    expect(visibility.mock.lastCall?.[0]).toEqual({
      accountIdentity: 'test-account',
      scrollY: scrollOffset,
      tradeTop: null,
      tradeBottom: null,
      viewportHeight: 0,
    });
    expect(mockOrderBookProps.mock.lastCall?.[0].viewportVisible).toBe(true);

    fireEvent(screen.getByTestId('perps-pro-info-list'), 'layout', {
      nativeEvent: { layout: { height: 700, width, x: 0, y: 0 } },
    });
    for (const measuredWidth of [0, width - 32]) {
      // The mocked book's layout event reaches the owner's outer onLayout.
      fireEvent(screen.getByTestId('realtime-order-book'), 'layout', {
        nativeEvent: {
          layout: { height: 480, width: measuredWidth, x: 0, y: 0 },
        },
      });
      expect(visibility.mock.lastCall?.[0]).toMatchObject({
        tradeTop: null,
        tradeBottom: null,
        viewportHeight: 700,
      });
      expect(mockOrderBookProps.mock.lastCall?.[0].viewportVisible).toBe(true);
    }

    fireEvent(screen.getByTestId('realtime-order-book'), 'layout', {
      nativeEvent: { layout: { height: 480, width, x: 0, y: 0 } },
    });
    expect(visibility.mock.lastCall?.[0]).toEqual({
      accountIdentity: 'test-account',
      scrollY: scrollOffset,
      tradeTop: 96,
      tradeBottom: 576,
      viewportHeight: 700,
    });
    expect(mockOrderBookProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      publicationEnabled: true,
      viewportVisible: false,
    });
  });

  it('invalidates old trade geometry on orientation change until the new width is measured', () => {
    const visibility = jest
      .spyOn(tradeDisplayVisibility, 'usePerpsProTradeDisplayVisibility')
      .mockImplementation(input =>
        tradeDisplayVisibility.isPerpsProTradeDisplayVisible({
          ...input,
          scrollY: 10_000,
        }),
      );
    const previousDimensions = {
      window: Dimensions.get('window'),
      screen: Dimensions.get('screen'),
    };
    const width = previousDimensions.window.width;
    const nextWidth = width + 300;
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
      }),
    );
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    try {
      fireEvent(screen.getByTestId('perps-pro-info-list'), 'layout', {
        nativeEvent: { layout: { height: 700, width, x: 0, y: 0 } },
      });
      fireEvent(screen.getByTestId('realtime-order-book'), 'layout', {
        nativeEvent: { layout: { height: 480, width, x: 0, y: 0 } },
      });
      expect(mockOrderBookProps.mock.lastCall?.[0].viewportVisible).toBe(false);

      act(() => {
        Dimensions.set({
          window: { ...previousDimensions.window, width: nextWidth },
          screen: { ...previousDimensions.screen, width: nextWidth },
        });
      });
      expect(visibility.mock.lastCall?.[0]).toMatchObject({
        tradeTop: null,
        tradeBottom: null,
      });
      expect(mockOrderBookProps.mock.lastCall?.[0].viewportVisible).toBe(true);

      fireEvent(screen.getByTestId('perps-pro-info-list'), 'layout', {
        nativeEvent: {
          layout: { height: 400, width: nextWidth, x: 0, y: 0 },
        },
      });
      expect(visibility.mock.lastCall?.[0]).toMatchObject({
        tradeTop: null,
        tradeBottom: null,
        viewportHeight: 400,
      });
      expect(mockOrderBookProps.mock.lastCall?.[0].viewportVisible).toBe(true);

      fireEvent(screen.getByTestId('realtime-order-book'), 'layout', {
        nativeEvent: {
          layout: { height: 520, width: nextWidth, x: 0, y: 0 },
        },
      });
      expect(visibility.mock.lastCall?.[0]).toMatchObject({
        tradeTop: 96,
        tradeBottom: 616,
        viewportHeight: 400,
      });
      expect(mockOrderBookProps.mock.lastCall?.[0]).toMatchObject({
        enabled: true,
        publicationEnabled: true,
        viewportVisible: false,
      });
    } finally {
      view.unmount();
      act(() => Dimensions.set(previousDimensions));
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
    const pageStyle = StyleSheet.flatten(getInfoList('account').props.style);
    const rowStartOffset = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .rowStartOffset;
    expect(pageStyle).toMatchObject({ minHeight: 1202 - rowStartOffset });
    expect(pageStyle?.paddingTop ?? 0).toBe(0);
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

  it('keeps Android vertical scrolling owned by the outer list including Trade', () => {
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
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
    expect(getInfoTrack()).toBeOnTheScreen();
    expect(screen.UNSAFE_getAllByType(SceneList)).toHaveLength(1);
    expect(infoTabs.map(tab => getInfoList(tab).props.data)).toHaveLength(3);
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

  it.each(['android', 'ios'] as const)(
    'commits a tab press only after %s UI-animation completion',
    platform => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: platform,
      });
      const persist = installOptimisticInfoPanelMock();
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      render(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      const list = getInfoList();
      const accountRows = getInfoList('account');
      fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
      expect(nativeBoundary.animations()).toHaveLength(1);
      expect(persist).not.toHaveBeenCalled();
      expect(
        screen.getByTestId('perps-pro-info-tab-account').props
          .accessibilityState,
      ).toEqual({ selected: true });
      physicalPageScroll(getInfoLeaf('openOrders').index);
      expect(persist).not.toHaveBeenCalled();
      pageState('idle');
      expect(persist.mock.calls).toEqual([['openOrders']]);
      expect(getInfoList()).toBe(list);
      expect(getInfoList('account')).toBe(accountRows);
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
    },
  );

  it('serializes rapid reverse tab presses while retaining all page identities', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    const persist = installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = getInfoList();
    const retainedLists = infoTabs.map(tab => getInfoList(tab));
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-account'));
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-positions'));
    expect(nativeBoundary.animations()).toHaveLength(1);
    expect(persist).not.toHaveBeenCalled();
    settleInfoPage('openOrders');
    expect(nativeBoundary.animations()).toHaveLength(1);
    expect(nativeBoundary.animationHistory()).toHaveLength(2);
    settleInfoPage('positions');
    expect(getInfoList()).toBe(list);
    expect(infoTabs.map(tab => getInfoList(tab))).toEqual(retainedLists);
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
    settleInfoPage('account');
    expect(getInfoList()).toBe(list);
    expect(infoTabs.map(tab => getInfoList(tab))).toEqual(retainedLists);
    expect(persist.mock.calls).toEqual([
      ['openOrders'],
      ['positions'],
      ['account'],
    ]);
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(2);
  });

  it('commits native row swipes through the same preference owner without native commands', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    const persist = installOptimisticInfoPanelMock(jest.fn(), {
      openOrdersByCategory: {
        basic: [],
        conditional: [{ key: 'conditional:BTC:1', coin: 'BTC' }],
      },
      openOrderCollectionPresentationByCategory: {
        basic: 'filteredEmpty',
        conditional: 'populated',
      },
      openOrderCounts: { basic: 0, conditional: 1, unsupported: 0 },
      allOpenOrdersCount: 1,
    });
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = getInfoList();
    // Mount notifications and repeated boundary notifications are not intent.
    pageScroll(2, 0);
    pageState('idle');
    expect(persist).not.toHaveBeenCalled();
    pageState('dragging');
    pageScroll(1, 0.7);
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBeCloseTo(1.7);
    pageState('settling');
    pageScroll(1, 0);
    expect(persist).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-info-tab-account').props.accessibilityState,
    ).toEqual({ selected: true });
    pageScroll(1, 0);
    pageState('idle');
    expect(
      screen.getByTestId('perps-pro-open-orders-controls'),
    ).toBeOnTheScreen();
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(1);
    // Enter the group's remembered/default child, not its directional edge.
    expect(
      screen.getByTestId('perps-pro-open-orders-tab-basic').props
        .accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('perps-pro-open-orders-empty')).toBeOnTheScreen();
    pageState('dragging');
    physicalPageScroll(1.6);
    finishPhysicalPage();
    expect(
      screen.getByTestId('perps-pro-open-orders-tab-conditional').props
        .accessibilityState.selected,
    ).toBe(true);
    // The empty sibling remains a real stop in the reverse direction too.
    pageState('dragging');
    physicalPageScroll(1.4);
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(1);
    pageState('settling');
    physicalPageScroll(1);
    finishPhysicalPage(1);
    expect(
      screen.getByTestId('perps-pro-open-orders-tab-basic').props
        .accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByTestId('perps-pro-open-orders-empty')).toBeOnTheScreen();
    expect(persist.mock.calls).toEqual([['openOrders']]);
    pageState('dragging');
    pageScroll(0, 0.3);
    pageState('settling');
    pageScroll(0, 0);
    expect(persist.mock.calls).toEqual([['openOrders']]);
    pageScroll(0, 0);
    pageState('idle');
    expect(
      screen.getByTestId('perps-pro-positions-controls'),
    ).toBeOnTheScreen();
    pageScroll(0, 0);
    pageState('idle');
    expect(persist.mock.calls).toEqual([['openOrders'], ['positions']]);
    expect(getInfoList()).toBe(list);
    expect(nativeBoundary.animations()).toHaveLength(0);
    expect(
      screen.getByTestId('perps-pro-info-tab-positions').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
    ).toBe(0);
  });

  it.each(['android', 'ios'] as const)(
    'keeps authoritative-empty Orders selected until a second native swipe on %s',
    platform => {
      jest.replaceProperty(Platform, 'OS', platform);
      const persist = jest.fn();
      let emptyOrderState = {
        openOrders: [],
        openOrdersByCategory: { basic: [], conditional: [] },
      };
      // Component coverage with the existing InfoPanel seam: native events
      // are supplied, so this cannot prove physical hit-testing or gestures.
      mockUsePerpsProInfoPanel.mockImplementation(function useInfoPanel() {
        const [activeInfoTab, setActiveInfoTab] =
          React.useState<InfoTab>('positions');
        return createInfoState({
          ...emptyOrderState,
          activeInfoTab,
          openOrderCollectionPresentation: 'authoritativeEmpty',
          setActiveInfoTab: (tab: InfoTab) => {
            setActiveInfoTab(tab);
            persist(tab);
          },
        });
      });
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      const props = {
        isModeSwitching: false,
        onSwitchToSimple: jest.fn(),
      };
      const view = render(<PerpsProScene {...props} />);
      const list = getInfoList();
      const pager = getInfoTrack();
      expect(nativeBoundary.animations()).toHaveLength(0);

      pageState('dragging');
      pageScroll(0, 0.6);
      expect(persist).not.toHaveBeenCalled();
      pageState('settling');
      pageScroll(1, 0);
      pageScroll(1, 0);
      expect(persist).not.toHaveBeenCalled();
      pageState('idle');

      const expectOrdersSelected = () => {
        expect(persist.mock.calls).toEqual([['openOrders']]);
        for (const tab of infoTabs) {
          expect(
            screen.getByTestId(`perps-pro-info-tab-${tab}`).props
              .accessibilityState.selected,
          ).toBe(tab === 'openOrders');
        }
        expect(
          screen.getByTestId('perps-pro-open-orders-empty-illustration'),
        ).toBeOnTheScreen();
        expect(
          screen.queryByTestId('perps-pro-open-orders-controls'),
        ).toBeNull();
        expect(getInfoPage('openOrders').props.pointerEvents).toBe('auto');
        expect(getInfoList()).toBe(list);
        expect(getInfoTrack()).toBe(pager);
        expect(
          screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
        ).toBe(1);
        expect(nativeBoundary.animations()).toHaveLength(0);
      };
      expectOrdersSelected();

      pageScroll(1, 0);
      pageState('idle');
      pageScroll(1, 0);
      expectOrdersSelected();

      view.rerender(<PerpsProScene {...props} />);
      expectOrdersSelected();
      emptyOrderState = {
        openOrders: [],
        openOrdersByCategory: { basic: [], conditional: [] },
      };
      view.rerender(<PerpsProScene {...props} />);
      pageScroll(1, 0);
      pageState('idle');
      expectOrdersSelected();

      pageState('dragging');
      pageScroll(1, 0.6);
      expect(persist.mock.calls).toEqual([['openOrders']]);
      pageState('settling');
      pageScroll(2, 0);
      pageScroll(2, 0);
      pageState('idle');
      expect(persist.mock.calls).toEqual([['openOrders'], ['account']]);
      expect(
        screen.getByTestId('perps-pro-info-tab-account').props
          .accessibilityState.selected,
      ).toBe(true);
      expect(getInfoPage('account').props.pointerEvents).toBe('auto');
      expect(getInfoList()).toBe(list);
      expect(getInfoTrack()).toBe(pager);
      expect(nativeBoundary.animations()).toHaveLength(0);
    },
  );

  it.each(['android', 'ios'] as const)(
    'does not commit a cancelled native row swipe on %s',
    platform => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: platform,
      });
      const persist = installOptimisticInfoPanelMock();
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      render(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      const list = getInfoList();
      const data = list.props.data;

      pageState('dragging');
      pageScroll(1, 0.4);
      pageState('settling');
      pageScroll(2, 0);
      pageState('idle');

      expect(persist).not.toHaveBeenCalled();
      expect(getInfoList()).toBe(list);
      expect(list.props.data).toBe(data);
      expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
      expect(
        screen.getByTestId('perps-pro-info-tab-account').props
          .accessibilityState,
      ).toEqual({ selected: true });
      expect(
        screen.UNSAFE_getByType(PerpsProTabIndicator).props.position.value,
      ).toBe(2);
    },
  );

  it.each([
    ['basic', 'account', 2.5],
    ['conditional', 'positions', 0.5],
  ] as const)(
    'preserves Orders %s after clicking %s and swiping back',
    (category, awayTab, returnProgress) => {
      installOptimisticInfoPanelMock(jest.fn(), {
        openOrderCategory: category,
      });
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      render(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
      settleInfoPage('openOrders');
      const list = getInfoList();
      const childList = getInfoList('openOrders');
      fireEvent.press(screen.getByTestId(`perps-pro-info-tab-${awayTab}`));
      settleInfoPage(awayTab);

      pageState('dragging');
      physicalPageScroll(returnProgress);
      expect(
        screen.getByTestId(`perps-pro-open-orders-tab-${category}`, {
          includeHiddenElements: true,
        }).props.accessibilityState.selected,
      ).toBe(true);
      finishPhysicalPage();

      expect(
        screen.getByTestId('perps-pro-info-tab-openOrders').props
          .accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByTestId(`perps-pro-open-orders-tab-${category}`).props
          .accessibilityState.selected,
      ).toBe(true);
      expect(getInfoPage('openOrders', category).props.pointerEvents).toBe(
        'auto',
      );
      expect(getInfoList()).toBe(list);
      expect(getInfoList('openOrders')).toBe(childList);
      expect(mockConfirmCancelAll).not.toHaveBeenCalled();
      expect(mockConfirmCancelOrder).not.toHaveBeenCalled();
    },
  );

  it('retains non-interactive neighbouring pages without committing or invoking trade actions', () => {
    const persist = installOptimisticInfoPanelMock();
    const switchToSimple = jest.fn();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    render(
      <PerpsProScene
        isModeSwitching={false}
        onSwitchToSimple={switchToSimple}
      />,
    );
    const list = getInfoList();
    const data = list.props.data;
    const neighbour = getInfoPage('openOrders', 'conditional');
    const retainedLists = infoTabs.map(tab => getInfoList(tab));
    pageState('dragging');
    pageScroll(1, 0.7);

    expect(getInfoPage('openOrders', 'conditional')).toBe(neighbour);
    expect(neighbour.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      pointerEvents: 'none',
    });
    expect(
      screen.getByTestId('perps-pro-open-orders-controls', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      within(neighbour).queryByTestId('perps-pro-open-orders-controls', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    let groupOwner = screen.getByTestId(
      'perps-pro-info-list-group-openOrders',
      {
        includeHiddenElements: true,
      },
    ).parent;
    while (groupOwner && groupOwner.props.pointerEvents === undefined) {
      groupOwner = groupOwner.parent;
    }
    expect(groupOwner?.props.pointerEvents).toBe('none');
    expect(getInfoList()).toBe(list);
    expect(infoTabs.map(tab => getInfoList(tab))).toEqual(retainedLists);
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

    pageState('settling');
    pageScroll(2, 0);
    pageState('idle');
    expect(getInfoPage('openOrders', 'conditional')).toBe(neighbour);
    expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it('scrolls the same native list for keyboard overlap using the current tab bounds', () => {
    installOptimisticInfoPanelMock();
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    const list = getInfoList();
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
    settleInfoPage('openOrders');
    fireEvent(
      screen.getByTestId('perps-pro-info-list'),
      'contentSizeChange',
      393,
      1000,
    );
    act(() => scrollPerpsProTradeAboveKeyboard(450));

    expect(getInfoList()).toBe(list);
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
    const list = getInfoList();
    const scrollToOffset = jest
      .spyOn(list.instance, 'scrollToOffset')
      .mockImplementation(() => undefined);
    fireEvent.press(screen.getByTestId('perps-pro-info-tab-openOrders'));
    settleInfoPage('openOrders');

    await act(async () => {
      await mockOpenOrderCardProps.mock.lastCall?.[0].onPressMarket('BTC');
    });

    expect(selectMarketByCoin).toHaveBeenCalledWith('BTC');
    expect(getInfoList()).toBe(list);
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
    const list = getInfoList();
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
    expect(nativeBoundary.animations()).toHaveLength(1);
    settleInfoPage('positions');
    expect(getInfoList()).toBe(list);
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

  it('mounts the selector on demand without rerendering Scene and keeps it through dismiss/reopen', () => {
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

    const view = render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.queryByTestId('market-selector')).toBeNull();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
    expect(mockMarketSelectorPresent).not.toHaveBeenCalled();
    const orderBookRendersBeforeOpen = mockOrderBookRender.mock.calls.length;
    const sceneRendersBeforeOpen = mockUsePerpsProScene.mock.calls.length;

    fireEvent.press(screen.getByTestId('market-bar'));

    expect(mockMarketSelectorPresent).toHaveBeenCalledTimes(1);
    expect(mockMarketSelectorMount).toHaveBeenCalledTimes(1);
    const selector = screen.getByTestId('market-selector');
    // Native onDismiss completes the existing close path, but the visit keeps
    // the same instance for an immediate reopen instead of rebuilding it.
    fireEvent(selector, 'dismiss');
    expect(
      mockUsePerpsProScene.mock.results.at(-1)?.value
        .cancelPendingMarketSelection,
    ).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('market-selector')).toBe(selector);
    expect(mockMarketSelectorUnmount).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('market-bar'));
    expect(mockMarketSelectorPresent).toHaveBeenCalledTimes(2);
    expect(mockMarketSelectorMount).toHaveBeenCalledTimes(1);
    expect(mockUsePerpsProScene).toHaveBeenCalledTimes(sceneRendersBeforeOpen);
    expect(mockOrderBookRender).toHaveBeenCalledTimes(
      orderBookRendersBeforeOpen,
    );
    view.rerender(
      <PerpsProScene
        isModeSwitching={false}
        onSwitchToSimple={jest.fn()}
        sceneActive={false}
      />,
    );
    expect(screen.queryByTestId('market-selector')).toBeNull();
    expect(mockMarketSelectorUnmount).toHaveBeenCalledTimes(1);
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );
    expect(screen.queryByTestId('market-selector')).toBeNull();
    fireEvent.press(screen.getByTestId('market-bar'));
    expect(mockMarketSelectorMount).toHaveBeenCalledTimes(2);
    expect(mockMarketSelectorPresent).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(mockMarketSelectorUnmount).toHaveBeenCalledTimes(2);
  });

  it('places the measured region alert above the Market and outside Trade', () => {
    mockPerpsStore.setState({ hasPermission: false });
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
    mockPerpsStore.setState({ hasPermission: false });
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
    mockPerpsStore.setState({ hasPermission: false });
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
    mockPerpsStore.setState({ hasPermission: false });
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

  it('prewarms K-line only after an active visit and retains one host across Root roundtrips', () => {
    const market = {
      canonicalCoin: 'BTC',
      marketKey: 'hyperliquid::BTC',
      marketData: { maxLeverage: 40, onlyIsolated: false },
      quoteAsset: 'USDC',
    };
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({ currentMarket: market, klineEnabled: true }),
    );
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} sceneActive={false} />);
    expect(screen.queryByTestId('kline-sheet')).toBeNull();
    expect(mockKlineMount).not.toHaveBeenCalled();
    expect(mockMarketSelectorMount).not.toHaveBeenCalled();

    view.rerender(<PerpsProScene {...props} sceneActive />);
    const kline = screen.getByTestId('kline-sheet');
    expect(mockKlineMount).toHaveBeenCalledTimes(1);
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: false,
      preloadEnabled: true,
      publicationEnabled: false,
      visible: false,
    });
    for (let roundtrip = 0; roundtrip < 2; roundtrip++) {
      view.rerender(<PerpsProScene {...props} sceneActive={false} />);
      expect(screen.getByTestId('kline-sheet')).toBe(kline);
      expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
        enabled: false,
        preloadEnabled: false,
        publicationEnabled: false,
        visible: false,
      });
      view.rerender(<PerpsProScene {...props} sceneActive />);
      expect(screen.getByTestId('kline-sheet')).toBe(kline);
    }
    expect(mockKlineMount).toHaveBeenCalledTimes(1);
    expect(mockKlineUnmount).not.toHaveBeenCalled();
    expect(mockMarketSelectorMount).not.toHaveBeenCalled();
    view.unmount();
    expect(mockKlineUnmount).toHaveBeenCalledTimes(1);
  });

  it('suspends retained K-line visibility/navigation on blur without replacing its market or open intent', () => {
    const registry =
      require('../components/common/perpsProSheetNavigationRegistry') as typeof import('../components/common/perpsProSheetNavigationRegistry');
    const market = {
      canonicalCoin: 'BTC',
      marketKey: 'hyperliquid::BTC',
      marketData: { maxLeverage: 40, onlyIsolated: false },
      quoteAsset: 'USDC',
    };
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({ currentMarket: market, klineEnabled: true }),
    );
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const kline = screen.getByTestId('kline-sheet');
    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(registry.getTopPerpsProSheetNavigationRegistration()).not.toBeNull();

    view.rerender(<PerpsProScene {...props} sceneActive={false} />);
    expect(registry.getTopPerpsProSheetNavigationRegistration()).toBeNull();
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: false,
      preloadEnabled: false,
      publicationEnabled: false,
      visible: false,
    });

    const nextMarket = {
      ...market,
      canonicalCoin: 'ETH',
      marketKey: 'hyperliquid::ETH',
    };
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({ currentMarket: nextMarket, klineEnabled: true }),
    );
    view.rerender(<PerpsProScene {...props} sceneActive={false} />);
    expect(screen.getByTestId('kline-sheet')).toBe(kline);
    expect(mockKlineProps.mock.lastCall?.[0].market).toBe(nextMarket);
    view.rerender(<PerpsProScene {...props} sceneActive />);
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      preloadEnabled: true,
      publicationEnabled: true,
      visible: true,
    });
    expect(registry.getTopPerpsProSheetNavigationRegistration()).not.toBeNull();
    expect(mockKlineMount).toHaveBeenCalledTimes(1);
    expect(mockKlineUnmount).not.toHaveBeenCalled();
    view.unmount();
    expect(registry.getTopPerpsProSheetNavigationRegistration()).toBeNull();
    expect(mockKlineUnmount).toHaveBeenCalledTimes(1);
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
      publicationEnabled: false,
      visible: false,
    });

    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      publicationEnabled: true,
      visible: true,
    });

    fireEvent.press(screen.getByTestId('kline-sheet'));
    expect(screen.getByTestId('kline-sheet')).toBeTruthy();
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      publicationEnabled: false,
      visible: false,
    });

    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      publicationEnabled: true,
      visible: true,
    });
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
      publicationEnabled: false,
    });

    act(() => onAppStateChange?.('active'));
    expect(mockKlineProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      preloadEnabled: true,
      publicationEnabled: true,
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

    settleInfoPage('openOrders');
    expect(
      screen.getByTestId('perps-pro-open-orders-empty-illustration'),
    ).toBeTruthy();
    expect(screen.getByText('page.perps.pro.openOrders.empty')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-open-orders-controls')).toBeNull();
  });

  it.each(['ios', 'android'] as const)(
    'settles only the requested Orders pill and keeps Cancel All on all coins of the committed category on %s',
    platform => {
      jest.replaceProperty(Platform, 'OS', platform);
      const basic = {
        key: 'basic:BTC:1',
        coin: 'BTC',
        oid: 1,
        category: 'basic',
      };
      const conditional = {
        key: 'conditional:BTC:2',
        coin: 'BTC',
        oid: 2,
        category: 'conditional',
      };
      const allBasic = [
        basic,
        { ...basic, key: 'basic:ETH:3', coin: 'ETH', oid: 3 },
      ];
      const allConditional = [
        conditional,
        { ...conditional, key: 'conditional:ETH:4', coin: 'ETH', oid: 4 },
      ];
      const byCategory = { basic: [basic], conditional: [conditional] };
      const committed = jest.fn();
      mockUsePerpsProScene.mockReturnValue(createSceneState());
      mockUsePerpsProInfoPanel.mockImplementation(function useInfo() {
        const [category, setCategory] = React.useState<'basic' | 'conditional'>(
          'basic',
        );
        return createInfoState({
          activeInfoTab: 'openOrders',
          openOrderCategory: category,
          openOrders: byCategory[category],
          openOrdersByCategory: byCategory,
          openOrderCollectionPresentationByCategory: {
            basic: 'populated',
            conditional: 'populated',
          },
          openOrderCounts: { basic: 2, conditional: 2, unsupported: 1 },
          allOpenOrdersCount: 4,
          hideOtherOpenOrderSymbols: true,
          openOrderCommandCandidates:
            category === 'basic' ? allBasic : allConditional,
          setOpenOrderCategory: (next: typeof category) => {
            committed(next);
            setCategory(next);
          },
        });
      });
      render(
        <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
      );
      const track = getInfoTrack();
      const basicList = getInfoList('openOrders');
      expect(screen.UNSAFE_getAllByType(SceneList)).toHaveLength(1);
      expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
      expect(
        screen.getAllByTestId('perps-pro-open-orders-controls'),
      ).toHaveLength(1);
      expect(
        within(getInfoPage('openOrders', 'basic')).queryByTestId(
          'perps-pro-open-orders-controls',
        ),
      ).toBeNull();
      fireEvent.press(
        within(screen.getByTestId('perps-pro-open-orders-controls')).getByRole(
          'button',
        ),
      );
      expect(mockConfirmCancelAll).toHaveBeenLastCalledWith(allBasic, 'basic');
      mockConfirmCancelAll.mockClear();
      fireEvent.press(
        screen.getByTestId('perps-pro-open-orders-tab-conditional'),
      );
      expect(nativeBoundary.animations()).toHaveLength(1);
      expect(committed).not.toHaveBeenCalled();
      expect(
        screen.getByTestId('perps-pro-open-orders-tab-basic', {
          includeHiddenElements: true,
        }).props.accessibilityState.selected,
      ).toBe(true);
      fireEvent.press(
        within(
          screen.getByTestId('perps-pro-open-orders-controls', {
            includeHiddenElements: true,
          }),
        ).getByRole('button', { includeHiddenElements: true }),
      );
      expect(mockConfirmCancelAll).not.toHaveBeenCalled();
      expect(getInfoPage('openOrders', 'conditional').props.pointerEvents).toBe(
        'none',
      );
      physicalPageScroll(2);
      expect(committed).not.toHaveBeenCalled();
      finishPhysicalPage(2);
      expect(committed).toHaveBeenCalledTimes(1);
      expect(committed).toHaveBeenCalledWith('conditional');
      expect(
        screen.getByTestId('perps-pro-open-orders-tab-conditional').props
          .accessibilityState.selected,
      ).toBe(true);
      fireEvent.press(
        within(screen.getByTestId('perps-pro-open-orders-controls')).getByRole(
          'button',
        ),
      );
      expect(mockConfirmCancelAll).toHaveBeenLastCalledWith(
        allConditional,
        'conditional',
      );
      expect(screen.UNSAFE_getAllByType(FlatList)).toContain(basicList);
      expect(getInfoPage('openOrders', 'conditional').props.pointerEvents).toBe(
        'auto',
      );
      expect(getInfoTrack()).toBe(track);
    },
  );

  it('catches up retained Orders callbacks, pending state, units and unfiltered edit position without replacing the data array', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const basic = {
      key: 'basic:BTC:1',
      coin: 'BTC',
      oid: 1,
      category: 'basic',
    };
    const conditional = {
      key: 'conditional:ETH:2',
      coin: 'ETH',
      oid: 2,
      category: 'conditional',
      side: 'sell',
      reduceOnly: true,
      editKind: 'triggerMarket',
    };
    const byCategory = { basic: [basic], conditional: [conditional] };
    const firstPosition = { coin: 'ETH', direction: 'long', baseSize: '1' };
    const nextPosition = { ...firstPosition, baseSize: '2' };
    const firstOpen = jest.fn();
    const latestOpen = jest.fn();
    const info = createInfoState({
      activeInfoTab: 'openOrders',
      openOrderCategory: 'basic',
      openOrders: byCategory.basic,
      openOrdersByCategory: byCategory,
      openOrderCollectionPresentationByCategory: {
        basic: 'populated',
        conditional: 'populated',
      },
      allPositionsByCoin: new Map([['ETH', firstPosition]]),
      positions: [],
      hideOtherPositionSymbols: true,
      openOrderCounts: { basic: 1, conditional: 1, unsupported: 0 },
    });
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(info);
    const editor = mockUsePerpsProOpenOrderEdit();
    mockUsePerpsProOpenOrderEdit.mockReturnValue({
      ...editor,
      open: firstOpen,
    });
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const conditionalList = screen
      .UNSAFE_getAllByType(FlatList)
      .find(
        node => node.props.testID === 'perps-pro-open-orders-rows-conditional',
      )!;
    const data = conditionalList.props.data;
    mockOpenOrderCardProps.mockClear();
    mockOrderPending = true;
    mockTradeAmountUnit = 'base';
    mockUsePerpsProInfoPanel.mockReturnValue({
      ...info,
      allPositionsByCoin: new Map([['ETH', nextPosition]]),
    });
    mockUsePerpsProOpenOrderEdit.mockReturnValue({
      ...editor,
      open: latestOpen,
    });
    view.rerender(<PerpsProScene {...props} />);
    expect(
      mockOpenOrderCardProps.mock.calls.some(
        ([value]) => value.order === conditional,
      ),
    ).toBe(false);
    expect(conditionalList.props.data).toBe(data);
    fireEvent.press(
      screen.getByTestId('perps-pro-open-orders-tab-conditional'),
    );
    const latest = mockOpenOrderCardProps.mock.calls
      .map(([value]) => value)
      .findLast(value => value.order === conditional);
    expect(latest).toMatchObject({
      amountUnit: 'base',
      cancelPending: true,
      editEnabled: true,
    });
    expect(conditionalList.props.data).toBe(data);
    expect(firstOpen).not.toHaveBeenCalled();
    expect(latestOpen).not.toHaveBeenCalled();
    expect(mockConfirmCancelOrder).not.toHaveBeenCalled();
    physicalPageScroll(2);
    finishPhysicalPage(2);
    act(() => latest.onEdit(conditional));
    expect(latestOpen).toHaveBeenCalledWith(conditional, nextPosition);
    act(() => latest.onCancel(conditional));
    expect(mockConfirmCancelOrder).toHaveBeenCalledWith(conditional);
  });

  it('remounts the UI track on account change while preserving the committed pill and rejecting old gesture callbacks', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const committed = jest.fn();
    const info = createInfoState({
      activeInfoTab: 'openOrders',
      openOrderCategory: 'conditional',
      accountIdentity: 'account-a',
      setOpenOrderCategory: committed,
    });
    mockUsePerpsProScene.mockReturnValue(createSceneState());
    mockUsePerpsProInfoPanel.mockReturnValue(info);
    const props = { isModeSwitching: false, onSwitchToSimple: jest.fn() };
    const view = render(<PerpsProScene {...props} />);
    const outer = getInfoTrack();
    const stalePan = infoPan();
    mockUsePerpsProInfoPanel.mockReturnValue({
      ...info,
      accountIdentity: 'account-b',
    });
    view.rerender(<PerpsProScene {...props} />);
    expect(getInfoTrack()).not.toBe(outer);
    expect(nativeBoundary.animations()).toHaveLength(0);
    act(() => {
      stalePan.handlers.onStart(panEvent());
      stalePan.handlers.onUpdate(panEvent(300));
      stalePan.handlers.onEnd(panEvent(300), true);
      stalePan.handlers.onFinalize?.(panEvent(300), true);
      nativeBoundary.finishAnimations();
    });
    expect(committed).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-open-orders-tab-conditional').props
        .accessibilityState.selected,
    ).toBe(true);
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
    settleInfoPage('openOrders');
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
    settleInfoPage('openOrders');
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

    settleInfoPage('openOrders');
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

    const rowStartOffset = screen.UNSAFE_getByType(PerpsProInfoSingleList).props
      .rowStartOffset;
    const expectedMinHeight = 1202 - rowStartOffset;
    expect(
      StyleSheet.flatten(getInfoList('account').props.style),
    ).toMatchObject({ minHeight: expectedMinHeight, paddingBottom: 386 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positions: [{ coin: 'BTC', key: 'BTC' }],
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    settleInfoPage('positions');
    expect(
      StyleSheet.flatten(getInfoList('positions').props.style),
    ).toMatchObject({ minHeight: expectedMinHeight, paddingBottom: 386 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'openOrders',
        openOrders: [{ coin: 'BTC', key: 'order-1' }],
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    settleInfoPage('openOrders');
    expect(
      StyleSheet.flatten(getInfoList('openOrders').props.style),
    ).toMatchObject({ minHeight: expectedMinHeight, paddingBottom: 386 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        activeInfoTab: 'positions',
        positionCollectionPresentation: 'authoritativeEmpty',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    settleInfoPage('positions');
    expect(
      StyleSheet.flatten(getInfoList('positions').props.style),
    ).toMatchObject({ minHeight: expectedMinHeight, paddingBottom: 32 });

    mockUsePerpsProInfoPanel.mockReturnValue(
      createInfoState({
        accountState: 'loading',
      }),
    );
    view.rerender(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    settleInfoPage('account');
    expect(
      StyleSheet.flatten(getInfoList('account').props.style),
    ).toMatchObject({ minHeight: expectedMinHeight, paddingBottom: 32 });
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
