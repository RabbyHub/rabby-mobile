import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { View as ProbeView } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { PerpsOriginScreen } from './index';
import { nativeBoundary } from '@/testUtils/linkedPagerNativeBoundary';
import type { StoreActivityScope } from '@/core/state/storeActivity';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';
import type { PerpsViewModeSnapshot } from '@/hooks/perps/viewMode/perpsViewModeController';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';

// The pager/adapter are real; business screens are spies. Native animation
// completion is explicit, so these are host contracts, not device gesture tests.
// Display/identity probes retain the real Zustand, activity scope and Hook
// implementations. They prove the Root boundary, not the business screens'
// choice of which account/risk subscriptions may safely use that boundary.
type TestMode = 'simple' | 'pro';
const mockDisplayStore = createStore(() => ({ price: 0 }));
const mockIdentityStore = createStore(() => ({ identity: 'account-a' }));
const mockActivityScopes = new Map<TestMode, StoreActivityScope>();

function MockSceneStoreProbe({ mode }: { mode: TestMode }) {
  const scope = useStoreActivityScope();
  const price = useActivityStore(
    mockDisplayStore,
    state => state.price,
    Object.is,
    { storeLabel: 'root-display-probe' },
  );
  // Critical identity uses an ordinary live subscription, even under an
  // inactive display scope. Re-rendering it must not refresh frozen display.
  const identity = useStore(mockIdentityStore, state => state.identity);
  React.useEffect(() => {
    mockActivityScopes.set(mode, scope);
    return () => {
      mockActivityScopes.delete(mode);
    };
  }, [mode, scope]);
  return (
    <ProbeView
      testID={`${mode}-store-probe`}
      accessibilityLabel={`${price}:${identity}`}
    />
  );
}

jest.mock('react-native-gesture-handler', () =>
  require('@/testUtils/linkedPagerNativeBoundary').createGestureBoundary(),
);
jest.mock('react-native-reanimated', () => ({
  ...require('@/testUtils/linkedPagerNativeBoundary').createReanimatedBoundary(),
  measure: jest.fn(),
}));
jest.mock('react-native-animateable-text', () => require('react-native').Text);
jest.mock('@/hooks/useRootPagerEnabled', () => ({
  useRootPagerEnabled: (focused: boolean) => focused,
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeTop: 24 }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ colors2024: { 'neutral-bg-1': '#ffffff' } }),
}));
jest.mock('./PerpsFundingHistoryOwner', () => ({
  PerpsFundingHistoryOwner: () => null,
}));
jest.mock('./PerpsRootHeader', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  const { runOnUI } = require('react-native-reanimated');
  return {
    PerpsRootHeader: ({
      activeMode,
      interactive,
      navigationEnabled = interactive,
      pagerUI,
      onSelectMode,
    }: {
      activeMode: string;
      interactive: boolean;
      navigationEnabled?: boolean;
      pagerUI?: RootScenePagerUI;
      onSelectMode: (mode: TestMode) => void;
    }) =>
      ReactModule.createElement(
        View,
        {
          testID: 'root-chrome',
          accessibilityLabel: activeMode,
          accessibilityState: { disabled: !interactive },
        },
        ...(['simple', 'pro'] as const).map(mode =>
          ReactModule.createElement(Pressable, {
            key: mode,
            testID: `root-header-${mode}`,
            disabled: !navigationEnabled,
            onPress: () =>
              pagerUI
                ? runOnUI(pagerUI.select)(mode === 'simple' ? 0 : 1)
                : onSelectMode(mode),
          }),
        ),
      ),
  };
});

const mockSetViewMode = jest.fn<Promise<boolean>, [TestMode]>(async () => true);
const mockUseEnsurePerpsRuntime = jest.fn();
const mockPrefetchBaseline = jest.fn();
const mockCancelEntryIntent = jest.fn();
const mockPrewarmEntryIntent = jest.fn(() => mockCancelEntryIntent);
const mockGetHasShownPerpsGuidePopup = jest.fn(async () => true);
const mockSetHasShownPerpsGuidePopup = jest.fn(async () => undefined);
const mockGoBack = jest.fn();
const mockHidePortfolioBreakdown = jest.fn();
const mockRemoveBeforeRemoveListener = jest.fn();
const mockAddListener = jest.fn(
  (
    event: string,
    listener: (event: { preventDefault: () => void }) => void,
  ) => {
    mockNavigationListeners.set(event, listener);
    return mockRemoveBeforeRemoveListener;
  },
);
let mockRuntimeMounts = 0;
let mockRuntimeUnmounts = 0;
let mockMarketDataStatus: 'idle' | 'success' = 'idle';
let mockRouteParams:
  | { fromSource?: 'homePagePositionList'; market?: string }
  | undefined;
const mockNavigationListeners = new Map<
  string,
  (event: { preventDefault: () => void }) => void
>();
let mockPortfolioBreakdownVisible = false;
let mockFocused = true;
const mockFocusListeners = new Set<() => void>();
const mockPublishFocus = (focused: boolean) => {
  mockFocused = focused;
  mockFocusListeners.forEach(listener => listener());
};
let mockViewModeState: PerpsViewModeSnapshot = {
  hydrated: false,
  hasVisitedPro: false,
  viewMode: 'simple' as 'simple' | 'pro',
  savingMode: null as 'simple' | 'pro' | null,
  error: null as unknown,
};
const mockViewModeListeners = new Set<() => void>();
const mockPublishViewMode = (patch: Partial<PerpsViewModeSnapshot>) => {
  mockViewModeState = { ...mockViewModeState, ...patch };
  mockViewModeListeners.forEach(listener => listener());
};

// One snapshot and notification source serves both the real hydration/badge
// Hook and the real Root adapter. Only the persistence boundary is controlled.
// In particular, a save must publish without an unrelated screen.rerender().
jest.mock('@/hooks/perps/viewMode/perpsViewModeController', () => ({
  perpsViewModeController: {
    getSnapshot: () => mockViewModeState,
    subscribe: (listener: () => void) => {
      mockViewModeListeners.add(listener);
      return () => mockViewModeListeners.delete(listener);
    },
    hydrate: () => Promise.resolve(),
    setViewMode: async (mode: TestMode) => {
      mockPublishViewMode({ savingMode: mode, error: null });
      const success = await mockSetViewMode(mode);
      mockPublishViewMode({
        ...(success
          ? {
              viewMode: mode,
              hasVisitedPro: mockViewModeState.hasVisitedPro || mode === 'pro',
            }
          : {}),
        savingMode: null,
        error: success ? null : new Error('Preference write failed'),
      });
      return success;
    },
  },
}));

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  const subscribe = (listener: () => void) => {
    mockFocusListeners.add(listener);
    return () => mockFocusListeners.delete(listener);
  };
  const getSnapshot = () => mockFocused;
  return {
    useRoute: () => ({ params: mockRouteParams }),
    useIsFocused: () =>
      ReactModule.useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
  };
});

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({
    addListener: mockAddListener,
    goBack: mockGoBack,
  }),
}));

jest.mock('@/hooks/useTipsPopup', () => ({
  useHideTipsPopup: () => mockHidePortfolioBreakdown,
  useIsTipsPopupVisible: () => mockPortfolioBreakdownVisible,
}));

jest.mock('@/core/native/utils', () => ({
  IS_IOS: false,
}));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getHasShownPerpsGuidePopup: (...args: unknown[]) =>
      mockGetHasShownPerpsGuidePopup(...args),
    setHasShownPerpsGuidePopup: (...args: unknown[]) =>
      mockSetHasShownPerpsGuidePopup(...args),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const state = { currentPerpsAccount: null, marketData: [{}] };
  const perpsStore = (selector: (value: object) => unknown) =>
    selector({ ...state, marketDataStatus: mockMarketDataStatus });
  perpsStore.getState = () => state;
  return { perpsStore };
});

jest.mock('../PerpsPro/model/market', () => ({
  buildPerpsProMarkets: () => [{ canonicalCoin: 'SUI' }],
}));

jest.mock('../PerpsPro/model/resolveInitialMarket', () => ({
  resolveInitialPerpsProMarket: () => ({ canonicalCoin: 'SUI' }),
}));

jest.mock('../PerpsPro/session/perpsProMarketSession', () => ({
  getPerpsProMarketSession: () => ({ marketKey: 'hyperliquid::SUI' }),
}));

jest.mock('../PerpsPro/scene/perpsProZeroAddressLeverageBaseline', () => ({
  prefetchPerpsProZeroAddressLeverageBaseline: (...args: unknown[]) =>
    mockPrefetchBaseline(...args),
}));

jest.mock('../PerpsPro/scene/perpsProEntryIntent', () => ({
  prewarmPerpsProEntryIntent: (...args: unknown[]) =>
    mockPrewarmEntryIntent(...args),
}));

jest.mock('@/hooks/perps/runtime/useEnsurePerpsRuntime', () => ({
  useEnsurePerpsRuntime: (() => {
    const ReactModule = require('react');
    return () => {
      mockUseEnsurePerpsRuntime();
      ReactModule.useEffect(() => {
        mockRuntimeMounts += 1;
        return () => {
          mockRuntimeUnmounts += 1;
        };
      }, []);
    };
  })(),
}));

jest.mock('./PerpsSimpleScreen', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    PerpsSimpleScreen: ({
      isModeSwitching,
      onPressInPro,
      onPressOutPro,
      onRegionAlertLayout,
      onSwitchToPro,
      showProNewBadge,
      sceneActive,
    }: {
      isModeSwitching: boolean;
      onPressInPro?: () => void;
      onPressOutPro?: () => void;
      onRegionAlertLayout?: (event: object) => void;
      onSwitchToPro: () => void;
      showProNewBadge?: boolean;
      sceneActive?: boolean;
    }) =>
      ReactModule.createElement(
        View,
        {
          accessibilityLabel: `new:${String(showProNewBadge)}`,
          testID: 'simple-scene',
          accessibilityState: { selected: sceneActive },
        },
        ReactModule.createElement(Text, null, 'Simple scene'),
        ReactModule.createElement(MockSceneStoreProbe, { mode: 'simple' }),
        ReactModule.createElement(View, {
          onLayout: onRegionAlertLayout,
          testID: 'simple-region-alert',
        }),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: isModeSwitching },
          disabled: isModeSwitching,
          onPress: onSwitchToPro,
          onPressIn: onPressInPro,
          onPressOut: onPressOutPro,
          testID: 'switch-to-pro',
        }),
      ),
  };
});

jest.mock('./components/PerpsGuideEntryPopup', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsGuideEntryPopup: ({
      onClose,
      visible,
    }: {
      onClose?: () => void;
      visible?: boolean;
    }) =>
      visible
        ? ReactModule.createElement(Pressable, {
            onPress: onClose,
            testID: 'perps-guide-entry-popup',
          })
        : null,
  };
});

jest.mock('../PerpsPro', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    PerpsProScreen: ({
      initialRegionAlertLayout,
      isModeSwitching,
      onSwitchToSimple,
      sceneActive,
    }: {
      initialRegionAlertLayout?: { height: number; width: number } | null;
      isModeSwitching: boolean;
      onSwitchToSimple: () => void;
      sceneActive?: boolean;
    }) =>
      ReactModule.createElement(
        View,
        {
          accessibilityLabel: initialRegionAlertLayout
            ? `${initialRegionAlertLayout.width}:${initialRegionAlertLayout.height}`
            : 'no-alert-layout',
          testID: 'pro-scene',
          accessibilityState: { selected: sceneActive },
        },
        ReactModule.createElement(Text, null, 'Pro scene'),
        ReactModule.createElement(MockSceneStoreProbe, { mode: 'pro' }),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: isModeSwitching },
          disabled: isModeSwitching,
          onPress: onSwitchToSimple,
          testID: 'switch-to-simple',
        }),
      ),
  };
});

describe('PerpsOriginScreen', () => {
  const originalIdle = global.requestIdleCallback;
  const originalCancelIdle = global.cancelIdleCallback;
  let idle: IdleRequestCallback | undefined;
  const layout = (screen: ReturnType<typeof render>) =>
    fireEvent(screen.getByTestId('perps-root-viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 700 } },
    });
  const settle = async () => {
    await act(async () => nativeBoundary.finishAnimations());
  };
  const hidden = { includeHiddenElements: true };
  const displayDiagnostics = (mode: TestMode) => {
    const store = mockActivityScopes
      .get(mode)
      ?.getDiagnostics()
      .stores.find(candidate => candidate.label === 'root-display-probe');
    if (!store) {
      throw new Error(`Missing real display activity scope for ${mode}`);
    }
    return store;
  };
  const displaySnapshot = (screen: ReturnType<typeof render>, mode: TestMode) =>
    screen.getByTestId(`${mode}-store-probe`, hidden).props.accessibilityLabel;
  const expectStableBusinessHosts = (screen: ReturnType<typeof render>) => {
    for (const mode of ['simple', 'pro']) {
      expect(
        screen.getByTestId(`perps-root-business-${mode}`, hidden).props
          .collapsable,
      ).toBe(false);
    }
  };
  const startPreview = (source: TestMode) => {
    const gesture = nativeBoundary.latestPan();
    const event = {
      x: source === 'simple' ? 300 : 60,
      y: 300,
      absoluteX: source === 'simple' ? 300 : 60,
      absoluteY: 300,
      translationX: source === 'simple' ? -180 : 180,
      translationY: 0,
      velocityX: 0,
    };
    act(() => {
      gesture.touchesDown?.(
        { allTouches: [event], numberOfTouches: 1 },
        { fail: jest.fn(), activate: jest.fn(), end: jest.fn() },
      );
      gesture.handlers.onStart(event);
      gesture.handlers.onUpdate(event);
    });
    return {
      finish: (complete: boolean) =>
        act(() => {
          if (complete) {
            gesture.handlers.onEnd(event, true);
          }
          gesture.handlers.onFinalize(event, complete);
        }),
    };
  };
  beforeEach(() => {
    jest.clearAllMocks();
    nativeBoundary.reset();
    idle = undefined;
    global.requestIdleCallback = jest.fn(callback => {
      idle = callback;
      return 1;
    });
    global.cancelIdleCallback = jest.fn();
    mockSetViewMode.mockResolvedValue(true);
    mockRuntimeMounts = 0;
    mockRuntimeUnmounts = 0;
    mockMarketDataStatus = 'idle';
    mockRouteParams = undefined;
    mockNavigationListeners.clear();
    mockPortfolioBreakdownVisible = false;
    mockFocused = true;
    mockFocusListeners.clear();
    mockActivityScopes.clear();
    mockViewModeListeners.clear();
    mockDisplayStore.setState({ price: 0 });
    mockIdentityStore.setState({ identity: 'account-a' });
    mockViewModeState = {
      hydrated: false,
      hasVisitedPro: false,
      viewMode: 'simple',
      savingMode: null,
      error: null,
    };
  });

  afterEach(async () => {
    await cleanupAsync();
    expect(mockViewModeListeners.size).toBe(0);
    expect(mockFocusListeners.size).toBe(0);
    jest.useRealTimers();
  });
  afterAll(() => {
    global.requestIdleCallback = originalIdle;
    global.cancelIdleCallback = originalCancelIdle;
  });

  it('keeps both scenes unmounted while the native route background owns hydration', () => {
    const screen = render(<PerpsOriginScreen />);

    expect(screen.queryByTestId('simple-scene')).toBeNull();
    expect(screen.queryByTestId('pro-scene')).toBeNull();
    expect(screen.toJSON()).toBeNull();
    expect(mockRuntimeMounts).toBe(1);
  });

  it('prewarms the saved Pro market while the Simple scene is visible', () => {
    mockMarketDataStatus = 'success';
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
      viewMode: 'simple',
    };

    render(<PerpsOriginScreen />);

    expect(mockPrefetchBaseline).toHaveBeenCalledWith('SUI');
  });

  it('shows the New badge only before the persisted Pro visit', () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
      hasVisitedPro: false,
    };
    const screen = render(<PerpsOriginScreen />);
    expect(screen.getByTestId('simple-scene').props.accessibilityLabel).toBe(
      'new:true',
    );

    act(() => mockPublishViewMode({ hasVisitedPro: true }));
    expect(screen.getByTestId('simple-scene').props.accessibilityLabel).toBe(
      'new:false',
    );
  });

  it('retains both scenes and activates only the settled mode without remounting Runtime', async () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    const screen = render(<PerpsOriginScreen />);
    layout(screen);

    expect(screen.getByTestId('simple-scene')).toBeOnTheScreen();
    expect(screen.queryByTestId('pro-scene')).toBeNull();
    expect(mockRuntimeMounts).toBe(1);

    fireEvent(screen.getByTestId('simple-region-alert'), 'layout', {
      nativeEvent: { layout: { height: 52, width: 361, x: 16, y: 56 } },
    });

    fireEvent.press(screen.getByTestId('switch-to-pro'));
    expect(mockSetViewMode).not.toHaveBeenCalled();
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('simple-scene', hidden).props.accessibilityState
        .selected,
    ).toBe(true);
    await settle();
    expect(mockSetViewMode).toHaveBeenCalledWith('pro');

    expect(
      screen.getByTestId('simple-scene', hidden).props.accessibilityState
        .selected,
    ).toBe(false);
    expect(screen.getByTestId('pro-scene')).toBeOnTheScreen();
    expect(screen.getByTestId('pro-scene').props.accessibilityLabel).toBe(
      '361:52',
    );
    expect(mockRuntimeMounts).toBe(1);
    expect(mockRuntimeUnmounts).toBe(0);

    fireEvent.press(screen.getByTestId('switch-to-simple'));
    await settle();
    expect(mockSetViewMode).toHaveBeenCalledWith('simple');
    expect(mockHidePortfolioBreakdown).toHaveBeenCalled();
  });

  it('prepares its neighbor at idle without activating or persisting a visit', () => {
    mockViewModeState = { ...mockViewModeState, hydrated: true };
    const screen = render(<PerpsOriginScreen />);
    act(() => idle?.({ didTimeout: false, timeRemaining: () => 12 }));
    expect(
      screen.getByTestId('simple-scene').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('pro-scene', hidden).props.accessibilityState.selected,
    ).toBe(false);
    expect(mockSetViewMode).not.toHaveBeenCalled();
  });

  it('starts directly in a hydrated Pro preference without mounting Simple first', () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
      viewMode: 'pro',
    };
    const screen = render(<PerpsOriginScreen />);
    expect(
      screen.getByTestId('pro-scene').props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.queryByTestId('simple-scene', hidden)).toBeNull();
    expect(mockSetViewMode).not.toHaveBeenCalled();
  });

  it.each<TestMode>(['simple', 'pro'])(
    'keeps %s live while its preview stays frozen, including cancellation and identity updates',
    async source => {
      const target = source === 'simple' ? 'pro' : 'simple';
      mockViewModeState = {
        ...mockViewModeState,
        hydrated: true,
        viewMode: source,
      };
      const screen = render(<PerpsOriginScreen />);
      layout(screen);
      act(() => idle?.({ didTimeout: false, timeRemaining: () => 12 }));
      expectStableBusinessHosts(screen);
      expect(displayDiagnostics(target)).toMatchObject({
        sourceSubscribed: false,
        activationCount: 0,
        catchUpCount: 0,
      });
      act(() => mockDisplayStore.setState({ price: 1 }));

      const drag = startPreview(source);
      expectStableBusinessHosts(screen);
      // The source is selected but not interactive; the neighbor is visible
      // but not selected. Neither touch gating nor visibility owns activity.
      expect(
        screen.getByTestId(`perps-root-business-${source}`, hidden).props
          .pointerEvents,
      ).toBe('none');
      expect(
        screen.getByTestId(`${source}-scene`, hidden).props.accessibilityState
          .selected,
      ).toBe(true);
      expect(
        screen.getByTestId(`${target}-scene`, hidden).props.accessibilityState
          .selected,
      ).toBe(false);
      expect(displaySnapshot(screen, target)).toBe('0:account-a');
      act(() => {
        mockDisplayStore.setState({ price: 2 });
        mockIdentityStore.setState({ identity: 'account-b' });
      });
      expect(displaySnapshot(screen, source)).toBe('2:account-b');
      expect(displaySnapshot(screen, target)).toBe('0:account-b');
      expect(displayDiagnostics(source)).toMatchObject({
        sourceSubscribed: true,
        sourceSubscribeCount: 1,
        sourceUnsubscribeCount: 0,
        sourceNotificationCount: 2,
      });
      expect(displayDiagnostics(target)).toMatchObject({
        sourceSubscribed: false,
        activationCount: 0,
        sourceNotificationCount: 0,
        publishedNotificationCount: 0,
        catchUpCount: 0,
      });

      drag.finish(false);
      await settle();
      expectStableBusinessHosts(screen);
      expect(displaySnapshot(screen, target)).toBe('0:account-b');
      expect(displayDiagnostics(target).sourceSubscribeCount).toBe(0);
      expect(displayDiagnostics(source).sourceUnsubscribeCount).toBe(0);
      expect(mockSetViewMode).not.toHaveBeenCalled();
      screen.unmount();
      expect(mockActivityScopes.size).toBe(0);
    },
  );

  it.each<TestMode>(['simple', 'pro'])(
    'catches up once after leaving %s, without waiting for the preference save',
    async source => {
      const target = source === 'simple' ? 'pro' : 'simple';
      mockViewModeState = {
        ...mockViewModeState,
        hydrated: true,
        viewMode: source,
      };
      let finishSave: (success: boolean) => void = () => undefined;
      mockSetViewMode.mockImplementationOnce(
        () => new Promise(resolve => (finishSave = resolve)),
      );
      const screen = render(<PerpsOriginScreen />);
      layout(screen);
      act(() => idle?.({ didTimeout: false, timeRemaining: () => 12 }));
      expectStableBusinessHosts(screen);
      act(() => mockDisplayStore.setState({ price: 1 }));
      const drag = startPreview(source);
      expectStableBusinessHosts(screen);
      act(() => {
        mockDisplayStore.setState({ price: 2 });
        mockDisplayStore.setState({ price: 3 });
      });
      expect(displayDiagnostics(target).sourceSubscribeCount).toBe(0);
      expect(displaySnapshot(screen, target)).toBe('0:account-a');

      drag.finish(true);
      expectStableBusinessHosts(screen);
      // Finger release starts the snap; only animation settlement transfers
      // display ownership, so the target must remain frozen during the snap.
      expect(displayDiagnostics(target)).toMatchObject({
        sourceSubscribed: false,
        sourceSubscribeCount: 0,
        catchUpCount: 0,
      });
      expect(displayDiagnostics(source)).toMatchObject({
        sourceSubscribed: true,
        sourceSubscribeCount: 1,
        sourceUnsubscribeCount: 0,
      });
      await settle();
      expectStableBusinessHosts(screen);
      expect(mockSetViewMode).toHaveBeenCalledWith(target);
      expect(displaySnapshot(screen, target)).toBe('3:account-a');
      expect(displayDiagnostics(target)).toMatchObject({
        sourceSubscribed: true,
        activationCount: 1,
        sourceSubscribeCount: 1,
        catchUpCount: 1,
        publishedNotificationCount: 1,
      });
      expect(displayDiagnostics(source).sourceSubscribed).toBe(false);
      // Saving a return-visit preference is not business authorization. The
      // settled scene is active and touchable while this write remains pending.
      expect(
        screen.getByTestId(`${target}-scene`).props.accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByTestId(`perps-root-business-${target}`).props.pointerEvents,
      ).toBe('auto');
      expect(mockViewModeState.savingMode).toBe(target);
      expect(mockViewModeState.viewMode).toBe(source);
      act(() => mockDisplayStore.setState({ price: 4 }));
      expect(displaySnapshot(screen, target)).toBe('4:account-a');
      expect(displaySnapshot(screen, source)).toBe('3:account-a');

      await act(async () => finishSave(true));
      expect(mockViewModeState).toMatchObject({
        viewMode: target,
        savingMode: null,
      });
      expectStableBusinessHosts(screen);
      expect(
        screen.getByTestId(`${target}-scene`).props.accessibilityState.selected,
      ).toBe(true);
      expect(
        screen.getByTestId(`perps-root-business-${target}`).props.pointerEvents,
      ).toBe('auto');
      expect(displayDiagnostics(target)).toMatchObject({
        activationCount: 1,
        deactivationCount: 0,
        sourceSubscribeCount: 1,
        sourceUnsubscribeCount: 0,
        catchUpCount: 1,
      });
      expect(displayDiagnostics(source).sourceSubscribeCount).toBe(1);
    },
  );

  it.each<TestMode>(['simple', 'pro'])(
    'resumes only selected %s on focus, while identity stays live through blur',
    selected => {
      const neighbor = selected === 'simple' ? 'pro' : 'simple';
      mockViewModeState = {
        ...mockViewModeState,
        hydrated: true,
        viewMode: selected,
      };
      const screen = render(<PerpsOriginScreen />);
      layout(screen);
      act(() => idle?.({ didTimeout: false, timeRemaining: () => 12 }));
      act(() => mockPublishFocus(false));
      expect(displayDiagnostics(selected).sourceSubscribed).toBe(false);
      for (const mode of [selected, neighbor]) {
        expect(
          screen.getByTestId(`${mode}-scene`, hidden).props.accessibilityState
            .selected,
        ).toBe(false);
        expect(
          screen.getByTestId(`perps-root-business-${mode}`, hidden).props
            .pointerEvents,
        ).toBe('none');
      }
      act(() => {
        mockDisplayStore.setState({ price: 1 });
        mockDisplayStore.setState({ price: 2 });
        mockIdentityStore.setState({ identity: 'account-b' });
      });
      expect(displaySnapshot(screen, selected)).toBe('0:account-b');
      expect(displaySnapshot(screen, neighbor)).toBe('0:account-b');

      act(() => mockPublishFocus(true));
      expect(displaySnapshot(screen, selected)).toBe('2:account-b');
      expect(displaySnapshot(screen, neighbor)).toBe('0:account-b');
      expect(displayDiagnostics(selected)).toMatchObject({
        sourceSubscribed: true,
        sourceSubscribeCount: 2,
        sourceUnsubscribeCount: 1,
        catchUpCount: 1,
        publishedNotificationCount: 1,
      });
      expect(displayDiagnostics(neighbor).sourceSubscribeCount).toBe(0);
      expect(mockSetViewMode).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'persists a root swipe only after successful settlement (%s)',
    async complete => {
      mockViewModeState = { ...mockViewModeState, hydrated: true };
      const screen = render(<PerpsOriginScreen />);
      layout(screen);
      const gesture = nativeBoundary.latestPan();
      const event = {
        x: 300,
        y: 300,
        absoluteX: 300,
        absoluteY: 300,
        translationX: -180,
        translationY: 0,
        velocityX: 0,
      };
      act(() => {
        gesture.touchesDown?.(
          { allTouches: [event], numberOfTouches: 1 },
          { fail: jest.fn(), activate: jest.fn(), end: jest.fn() },
        );
        gesture.handlers.onStart(event);
        gesture.handlers.onUpdate(event);
        if (complete) {
          gesture.handlers.onEnd(event, true);
        }
        gesture.handlers.onFinalize(event, complete);
      });
      expect(mockSetViewMode).not.toHaveBeenCalled();
      expect(screen.getAllByTestId('root-chrome')).toHaveLength(1);
      // The opaque wash inherits the real Pro page's horizontal track. The
      // shared overlay contains controls only, so its color cannot lag a drag.
      expect(
        within(screen.getByTestId('perps-root-page-pro', hidden)).getByTestId(
          'perps-pro-header-wash-clip',
          hidden,
        ),
      ).toBeTruthy();
      expect(
        within(
          screen.getByTestId('perps-root-page-simple', hidden),
        ).queryByTestId('perps-pro-header-wash-clip', hidden),
      ).toBeNull();
      expect(
        within(screen.getByTestId('perps-root-overlay')).queryByTestId(
          'perps-pro-header-wash-clip',
          hidden,
        ),
      ).toBeNull();
      expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
        'simple',
      );
      expect(
        screen.getByTestId('root-chrome').props.accessibilityState.disabled,
      ).toBe(true);
      expect(
        screen.getByTestId('pro-scene', hidden).props.accessibilityState
          .selected,
      ).toBe(false);
      await settle();
      if (complete) {
        expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
          'pro',
        );
        expect(mockSetViewMode).toHaveBeenCalledTimes(1);
        expect(mockSetViewMode).toHaveBeenCalledWith('pro');
        expect(
          screen.getByTestId('pro-scene').props.accessibilityState.selected,
        ).toBe(true);
      } else {
        expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
          'simple',
        );
        expect(mockSetViewMode).not.toHaveBeenCalled();
        expect(
          screen.getByTestId('simple-scene').props.accessibilityState.selected,
        ).toBe(true);
      }
      // Swipes have no press-in warmup. Neither request nor settlement should
      // synthesize one; the active Pro scene owns its required initialization.
      expect(mockPrewarmEntryIntent).not.toHaveBeenCalled();
    },
  );

  it.each<TestMode>(['simple', 'pro'])(
    'allows an immediate reverse to %s while the first preference save is pending',
    async source => {
      const target = source === 'simple' ? 'pro' : 'simple';
      mockViewModeState = {
        ...mockViewModeState,
        hydrated: true,
        viewMode: source,
      };
      let finishSave: (success: boolean) => void = () => undefined;
      mockSetViewMode.mockImplementationOnce(
        () => new Promise(resolve => (finishSave = resolve)),
      );
      const screen = render(<PerpsOriginScreen />);
      layout(screen);

      fireEvent.press(screen.getByTestId(`root-header-${target}`));
      await settle();
      expect(mockViewModeState).toMatchObject({
        viewMode: source,
        savingMode: target,
      });
      expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
        target,
      );
      expect(
        screen.getByTestId('root-chrome').props.accessibilityState.disabled,
      ).toBe(false);
      expect(nativeBoundary.latestPan().config.enabled).toBe(true);
      expect(
        screen.getByTestId(`perps-root-business-${target}`).props.pointerEvents,
      ).toBe('auto');

      const reverse = startPreview(target);
      expect(
        screen.getByTestId('root-chrome').props.accessibilityState.disabled,
      ).toBe(true);
      reverse.finish(true);
      await settle();
      expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
        source,
      );
      expect(
        screen.getByTestId(`${source}-scene`).props.accessibilityState.selected,
      ).toBe(true);
      expect(mockSetViewMode.mock.calls).toEqual([[target]]);
      expect(mockViewModeState.savingMode).toBe(target);

      // The older result must not drag the current UI back. Only after that
      // write finishes may the adapter persist the newest settled selection.
      await act(async () => finishSave(true));
      expect(mockSetViewMode.mock.calls).toEqual([[target], [source]]);
      expect(mockViewModeState).toMatchObject({
        viewMode: source,
        savingMode: null,
      });
      expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
        source,
      );
      expect(nativeBoundary.animations()).toHaveLength(0);
      expect(mockRuntimeMounts).toBe(1);
      expect(mockRuntimeUnmounts).toBe(0);
    },
  );

  it('keeps the settled scene active and interactive when its preference save fails', async () => {
    mockViewModeState = { ...mockViewModeState, hydrated: true };
    let finishSave: (result: boolean) => void = () => undefined;
    mockSetViewMode.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishSave = resolve;
        }),
    );
    const screen = render(<PerpsOriginScreen />);
    layout(screen);
    fireEvent.press(screen.getByTestId('switch-to-pro'));
    await settle();
    expect(
      screen.getByTestId('root-chrome').props.accessibilityState.disabled,
    ).toBe(false);
    expect(
      screen.getByTestId('perps-root-business-pro').props.pointerEvents,
    ).toBe('auto');
    expect(
      screen.getByTestId('pro-scene').props.accessibilityState.selected,
    ).toBe(true);
    await act(async () => finishSave(false));
    expect(nativeBoundary.animations()).toHaveLength(0);
    expect(mockViewModeState.viewMode).toBe('simple');
    expect(mockViewModeState.error).toBeInstanceOf(Error);
    expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
      'pro',
    );
    expect(
      screen.getByTestId('pro-scene').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('perps-root-business-pro').props.pointerEvents,
    ).toBe('auto');
    expect(mockSetViewMode).toHaveBeenCalledTimes(1);
    // A failed preference is neither an interaction lock nor a navigation
    // command. The shared Header can immediately select the other scene.
    fireEvent.press(screen.getByTestId('root-header-simple'));
    await settle();
    expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
      'simple',
    );
  });

  it('does not prewarm or request JS mode changes from a UI-only Root Header tap', async () => {
    mockMarketDataStatus = 'success';
    mockViewModeState = { ...mockViewModeState, hydrated: true };
    const screen = render(<PerpsOriginScreen />);
    layout(screen);
    const pro = screen.getByTestId('root-header-pro');

    fireEvent(pro, 'pressIn');
    fireEvent(pro, 'pressOut');
    fireEvent.press(pro);
    // The UI-only tap starts native presentation. It neither replays the old
    // JS request callback nor starts an optional, potentially late press intent.
    expect(nativeBoundary.animations()).toHaveLength(1);
    expect(mockHidePortfolioBreakdown).not.toHaveBeenCalled();
    expect(mockPrewarmEntryIntent).not.toHaveBeenCalled();
    expect(mockSetViewMode).not.toHaveBeenCalled();
    await settle();
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(1);
    expect(mockPrewarmEntryIntent).not.toHaveBeenCalled();
    expect(mockSetViewMode).toHaveBeenCalledWith('pro');
    expect(
      screen.getByTestId('pro-scene').props.accessibilityState.selected,
    ).toBe(true);
  });

  // These exercise the retained legacy scene callbacks. The shared Root Header
  // has a separate UI-only selection path, covered above, with no press warmup.
  it('starts the exact Pro intent on press-in and cancels an abandoned press', () => {
    jest.useFakeTimers();
    mockMarketDataStatus = 'success';
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    const screen = render(<PerpsOriginScreen />);

    fireEvent(screen.getByTestId('switch-to-pro'), 'pressIn');
    expect(mockPrewarmEntryIntent).toHaveBeenCalledWith({
      accountAddress: undefined,
      market: { canonicalCoin: 'SUI' },
    });

    fireEvent(screen.getByTestId('switch-to-pro'), 'pressOut');
    act(() => jest.runOnlyPendingTimers());
    expect(mockCancelEntryIntent).toHaveBeenCalledTimes(1);
    expect(mockSetViewMode).not.toHaveBeenCalled();
  });

  it('keeps the intent alive when press-out is followed by the requested switch', async () => {
    jest.useFakeTimers();
    mockMarketDataStatus = 'success';
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    const screen = render(<PerpsOriginScreen />);
    layout(screen);
    const target = screen.getByTestId('switch-to-pro');

    fireEvent(target, 'pressIn');
    fireEvent(target, 'pressOut');
    fireEvent.press(target);
    act(() => jest.runOnlyPendingTimers());

    expect(mockSetViewMode).not.toHaveBeenCalled();
    expect(mockCancelEntryIntent).not.toHaveBeenCalled();
    await settle();
    expect(mockSetViewMode).toHaveBeenCalledWith('pro');
  });

  it('does not cancel a newer press-in intent when an older preference save fails', async () => {
    jest.useFakeTimers();
    mockViewModeState = { ...mockViewModeState, hydrated: true };
    const cancelOldIntent = jest.fn();
    const cancelNewIntent = jest.fn();
    mockPrewarmEntryIntent
      .mockReturnValueOnce(cancelOldIntent)
      .mockReturnValueOnce(cancelNewIntent);
    let finishSave: (success: boolean) => void = () => undefined;
    mockSetViewMode.mockImplementationOnce(
      () => new Promise(resolve => (finishSave = resolve)),
    );
    const screen = render(<PerpsOriginScreen />);
    layout(screen);

    fireEvent(screen.getByTestId('switch-to-pro'), 'pressIn');
    fireEvent.press(screen.getByTestId('switch-to-pro'));
    await settle();
    expect(mockViewModeState.savingMode).toBe('pro');
    const reverse = startPreview('pro');
    reverse.finish(true);
    await settle();
    expect(cancelOldIntent).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('switch-to-pro'), 'pressIn');
    expect(mockPrewarmEntryIntent).toHaveBeenCalledTimes(2);
    await act(async () => finishSave(false));
    expect(cancelNewIntent).not.toHaveBeenCalled();
    expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
      'simple',
    );
    expect(mockSetViewMode).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('switch-to-pro'), 'pressOut');
    fireEvent.press(screen.getByTestId('switch-to-pro'));
    act(() => jest.runOnlyPendingTimers());
    await settle();
    expect(cancelNewIntent).not.toHaveBeenCalled();
    expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
      'pro',
    );
    expect(mockSetViewMode).toHaveBeenCalledTimes(2);
  });

  it('does not gate a Header selection on an externally pending preference save', async () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
      savingMode: 'pro',
    };
    const screen = render(<PerpsOriginScreen />);
    layout(screen);

    expect(
      screen.getByTestId('switch-to-pro').props.accessibilityState,
    ).toEqual({
      disabled: false,
    });
    expect(
      screen.getByTestId('root-chrome').props.accessibilityState.disabled,
    ).toBe(false);
    fireEvent.press(screen.getByTestId('root-header-pro'));
    await settle();
    expect(screen.getByTestId('root-chrome').props.accessibilityLabel).toBe(
      'pro',
    );
    expect(
      screen.getByTestId('pro-scene').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('perps-root-business-pro').props.pointerEvents,
    ).toBe('auto');
    expect(mockSetViewMode).not.toHaveBeenCalled();
    await act(async () =>
      mockPublishViewMode({ viewMode: 'pro', savingMode: null }),
    );
    expect(mockSetViewMode).not.toHaveBeenCalled();
    expect(nativeBoundary.animations()).toHaveLength(0);
  });

  it('preserves the Android Home-position return guide on the Simple underlay', async () => {
    mockRouteParams = { fromSource: 'homePagePositionList' };
    mockGetHasShownPerpsGuidePopup.mockResolvedValueOnce(false);
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
      viewMode: 'simple',
    };
    const screen = render(<PerpsOriginScreen />);

    await act(async () => undefined);

    const preventDefault = jest.fn();
    act(() => {
      mockNavigationListeners.get('beforeRemove')?.({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('perps-guide-entry-popup'));
    expect(mockSetHasShownPerpsGuidePopup).toHaveBeenCalledWith(true);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('dismisses the owned Portfolio breakdown before removing the route', () => {
    mockPortfolioBreakdownVisible = true;
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    render(<PerpsOriginScreen />);

    const preventDefault = jest.fn();
    act(() => {
      mockNavigationListeners.get('beforeRemove')?.({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('cleans up the owned Portfolio breakdown on route blur and unmount', () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    const view = render(<PerpsOriginScreen />);

    act(() => {
      mockNavigationListeners.get('blur')?.({ preventDefault: jest.fn() });
    });
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(2);
  });
});
