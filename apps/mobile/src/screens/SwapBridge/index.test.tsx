import React from 'react';
import { TextInput, View } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { RootNames } from '@/constant/layout';
import {
  nativeBoundary,
  type PanBoundary,
} from '@/testUtils/linkedPagerNativeBoundary';

// Real root motion/retention; native animation completion is explicit. Business
// forms below are spies, so this is a host contract test, not quote integration.
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

const mockSetNavigationOptions = jest.fn();
const mockRegressionActions = new Map<string, () => Promise<void>>();
const mockSceneMounts = { swap: 0, bridge: 0 };
const mockSceneRenders = { swap: 0, bridge: 0 };
const mockCommittedScenes = new Map<string, boolean>();
let mockServiceReady = true;
let idleCallback: IdleRequestCallback | undefined;
const originalIdle = global.requestIdleCallback;
const originalCancelIdle = global.cancelIdleCallback;

// Route-scoped navigation boundary for component contracts. Native-stack's
// provider placement and the actual iOS transition still need device coverage.
jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  const Context = ReactModule.createContext(undefined);
  return {
    NavigationContext: Context,
    useRoute: () => ReactModule.useContext(Context).route,
    useNavigation: () => ReactModule.useContext(Context).navigation,
    useIsFocused: () => ReactModule.useContext(Context).focused,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: Function }) => ({
    styles: getStyle({
      colors2024: require('@/constant/theme').ThemeColors2024.light,
    }),
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: Function) => getStyle,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/AppStatusBar', () => ({
  useSafeSetNavigationOptions: () => ({
    setNavigationOptions: mockSetNavigationOptions,
  }),
}));
jest.mock('@/hooks/navigation', () => ({
  HeaderBackPressable: () => null,
}));
jest.mock('@/components/AccountSwitcher/Modal', () => ({
  AccountSwitcherModal: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'account-modal-host',
    }),
}));
jest.mock('@/components/AccountSwitcher/HeaderAccountSwitcher', () => ({
  HeaderAccountSwitcher: () => null,
}));
jest.mock('../Swap/components/Header', () => ({
  SwapHeader: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'swap-header-actions',
    }),
}));
jest.mock('../Bridge/components/BridgeHeader', () => ({
  BridgeHeader: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'bridge-header-actions',
    }),
}));
jest.mock('../Swap/components/TokenInfoPopup', () => ({
  TokenInfoPopup: () => null,
}));
jest.mock('@/core/utils/diagnosticEnv', () => ({
  isNonProductionDiagnosticsEnabled: false,
}));
jest.mock('@/hooks/useFeatureActivationDiagnostics', () => ({
  useFeatureActivationDiagnostics: jest.fn(),
}));
jest.mock('@/core/utils/featureActivationDiagnostics', () => ({
  ensureFeatureActivation: jest.fn(),
  markFeatureActivation: jest.fn(),
}));
jest.mock('@/devtools/regressionScenarios/react', () => ({
  useRegressionScenario: () => ({ active: false }),
  useRegressionScenarioComponentAction: (
    name: string,
    callback: () => Promise<void>,
  ) => {
    mockRegressionActions.set(name, callback);
  },
}));
jest.mock('../Swap/swapServiceDependencies', () => ({
  withSwapService: (Component: React.ComponentType, options: any) =>
    function MockServiceBoundary(props: any) {
      return mockServiceReady ? <Component {...props} /> : options.fallback;
    },
}));

function MockScene({
  kind,
  sceneActive,
}: {
  kind: 'swap' | 'bridge';
  sceneActive: boolean;
}) {
  mockSceneRenders[kind] += 1;
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    mockSceneMounts[kind] += 1;
  }, [kind]);
  React.useLayoutEffect(() => {
    mockCommittedScenes.set(kind, sceneActive);
    return () => {
      mockCommittedScenes.delete(kind);
    };
  }, [kind, sceneActive]);
  return (
    <View
      testID={`${kind}-scene`}
      accessibilityState={{ selected: sceneActive }}>
      <TextInput
        testID={`${kind}-amount`}
        value={value}
        onChangeText={setValue}
      />
    </View>
  );
}

jest.mock('./Swap', () => {
  const Scene = (props: any) => <MockScene kind="swap" {...props} />;
  return {
    __esModule: true,
    default: Object.assign(Scene, { ForMultipleAddress: Scene }),
  };
});
jest.mock('./Bridge', () => {
  const Scene = (props: any) => <MockScene kind="bridge" {...props} />;
  return { Bridge: Object.assign(Scene, { ForMultipleAddress: Scene }) };
});

const { NavigationContext } = require('@react-navigation/native');
const SwapBridgeScreen = require('./index')
  .default as typeof import('./index').default;
const { SwapBridgeHeader } =
  require('./SwapBridgeHeader') as typeof import('./SwapBridgeHeader');

function routeProps(activeTab: 'swap' | 'bridge' = 'swap') {
  return {
    route: { key: 'swap-a', name: RootNames.SwapBridge, params: { activeTab } },
    navigation: { setParams: jest.fn() },
    options: {},
    focused: true,
  };
}

function RouteBoundary({
  context,
  children,
  onCommit,
}: React.PropsWithChildren<{
  context: ReturnType<typeof routeProps>;
  onCommit?: () => void;
}>) {
  React.useLayoutEffect(() => {
    onCommit?.();
  });
  return (
    <NavigationContext.Provider value={context}>
      {children}
    </NavigationContext.Provider>
  );
}

beforeEach(() => {
  nativeBoundary.reset();
  jest.clearAllMocks();
  mockSceneMounts.swap = 0;
  mockSceneMounts.bridge = 0;
  mockSceneRenders.swap = 0;
  mockSceneRenders.bridge = 0;
  mockCommittedScenes.clear();
  mockRegressionActions.clear();
  mockServiceReady = true;
  idleCallback = undefined;
  global.requestIdleCallback = jest.fn(callback => {
    idleCallback = callback;
    return 1;
  });
  global.cancelIdleCallback = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
  global.requestIdleCallback = originalIdle;
  global.cancelIdleCallback = originalCancelIdle;
});

const hidden = { includeHiddenElements: true };
function layoutPagers(view: ReturnType<typeof render>) {
  for (const viewport of view.getAllByTestId('swap-bridge-root-viewport')) {
    fireEvent(viewport, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 700 } },
    });
  }
}
const settle = () => act(() => nativeBoundary.finishAnimations());

describe('SwapBridge route-owned scenes', () => {
  it.each(['swap', 'bridge'] as const)(
    'mounts only the initial %s scene',
    activeTab => {
      const context = routeProps(activeTab);
      const view = render(
        <RouteBoundary context={context}>
          <SwapBridgeScreen />
        </RouteBoundary>,
      );
      expect(view.getByTestId(`${activeTab}-scene`)).toBeTruthy();
      expect(mockSceneMounts).toEqual({
        swap: activeTab === 'swap' ? 1 : 0,
        bridge: activeTab === 'bridge' ? 1 : 0,
      });
    },
  );

  it('prepares new route params immediately, activates at settle and retains state', () => {
    const context = routeProps();
    const commits: Map<string, boolean>[] = [];
    const onCommit = () => commits.push(new Map(mockCommittedScenes));
    const view = render(
      <RouteBoundary context={context} onCommit={onCommit}>
        <SwapBridgeScreen />
      </RouteBoundary>,
    );
    layoutPagers(view);
    fireEvent.changeText(view.getByTestId('swap-amount'), '123');
    commits.length = 0;
    const bridgeContext = {
      ...context,
      route: { ...context.route, params: { activeTab: 'bridge' as const } },
    };
    view.rerender(
      <RouteBoundary context={bridgeContext} onCommit={onCommit}>
        <SwapBridgeScreen />
      </RouteBoundary>,
    );
    expect(mockCommittedScenes).toEqual(
      new Map([
        ['swap', true],
        ['bridge', false],
      ]),
    );
    settle();
    expect(mockCommittedScenes).toEqual(
      new Map([
        ['swap', false],
        ['bridge', true],
      ]),
    );
    fireEvent.changeText(view.getByTestId('bridge-amount'), '456');
    view.rerender(
      <RouteBoundary context={context}>
        <SwapBridgeScreen />
      </RouteBoundary>,
    );
    settle();
    expect(view.getByTestId('swap-amount').props.value).toBe('123');
    expect(
      view.getByTestId('bridge-amount', { includeHiddenElements: true }).props
        .value,
    ).toBe('456');
    expect(mockSceneMounts).toEqual({ swap: 1, bridge: 1 });
    expect(mockSetNavigationOptions).not.toHaveBeenCalled();
  });

  it('warms the neighboring preview only at idle and never activates it', () => {
    const view = render(
      <RouteBoundary context={routeProps()}>
        <SwapBridgeScreen />
      </RouteBoundary>,
    );
    expect(mockSceneMounts).toEqual({ swap: 1, bridge: 0 });
    const sourceRenderCount = mockSceneRenders.swap;
    act(() => idleCallback?.({ didTimeout: false, timeRemaining: () => 12 }));
    expect(mockSceneMounts).toEqual({ swap: 1, bridge: 1 });
    expect(mockCommittedScenes.get('bridge')).toBe(false);
    expect(mockSceneRenders.swap).toBe(sourceRenderCount);
    expect(view.getByTestId('bridge-scene', hidden)).toBeTruthy();
  });

  it.each([false, true])(
    'retains preview forms and publishes only a completed swipe (complete=%s)',
    complete => {
      const context = routeProps();
      const view = render(
        <RouteBoundary context={context}>
          <SwapBridgeScreen />
        </RouteBoundary>,
      );
      layoutPagers(view);
      const gesture = view.getByTestId('swap-bridge-root-pan').props
        .gesture as PanBoundary;
      const event = {
        x: 160,
        y: 300,
        absoluteX: 160,
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
      expect(context.navigation.setParams).not.toHaveBeenCalled();
      expect(mockCommittedScenes.get('swap')).toBe(true);
      settle();
      expect(mockSceneMounts).toEqual({ swap: 1, bridge: 1 });
      expect(mockCommittedScenes).toEqual(
        new Map([
          ['swap', !complete],
          ['bridge', complete],
        ]),
      );
      if (complete) {
        expect(context.navigation.setParams).toHaveBeenCalledTimes(1);
        expect(context.navigation.setParams).toHaveBeenCalledWith({
          activeTab: 'bridge',
        });
      } else {
        expect(context.navigation.setParams).not.toHaveBeenCalled();
      }
    },
  );

  it('routes regression tab actions through the same navigation params', async () => {
    const context = routeProps();
    render(
      <RouteBoundary context={context}>
        <SwapBridgeScreen />
      </RouteBoundary>,
    );
    const frame = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 1;
      });
    try {
      await act(async () => {
        await mockRegressionActions.get('swap-bridge.activate-bridge')?.();
      });
      expect(context.navigation.setParams).toHaveBeenCalledWith({
        activeTab: 'bridge',
      });
      await act(async () => {
        await mockRegressionActions.get('swap-bridge.activate-swap')?.();
      });
      expect(context.navigation.setParams).toHaveBeenLastCalledWith({
        activeTab: 'swap',
      });
    } finally {
      frame.mockRestore();
    }
  });
});

function RouteWithHeader({
  context,
}: {
  context: ReturnType<typeof routeProps>;
}) {
  return (
    <View testID={context.route.key}>
      <RouteBoundary context={context}>
        <SwapBridgeHeader {...(context as unknown as NativeStackHeaderProps)} />
        <SwapBridgeScreen />
      </RouteBoundary>
    </View>
  );
}

describe('SwapBridge configured header', () => {
  it('renders before the service is ready and uses the latest tab once content mounts', () => {
    mockServiceReady = false;
    const context = routeProps();
    const view = render(<RouteWithHeader context={context} />);
    expect(view.getByText('Swap')).toBeTruthy();
    expect(view.getByTestId('swap-header-actions')).toBeTruthy();
    expect(view.queryByTestId('swap-scene')).toBeNull();
    expect(view.queryByTestId('bridge-scene')).toBeNull();
    fireEvent.press(view.getByText('Bridge'));
    expect(context.navigation.setParams).toHaveBeenCalledWith({
      activeTab: 'bridge',
    });
    mockServiceReady = true;
    view.rerender(
      <RouteWithHeader
        context={{
          ...context,
          route: { ...context.route, params: { activeTab: 'bridge' } },
        }}
      />,
    );
    expect(view.getByTestId('bridge-scene')).toBeTruthy();
    expect(view.getByTestId('bridge-header-actions')).toBeTruthy();
    expect(mockSceneMounts).toEqual({ swap: 0, bridge: 1 });
    expect(mockSetNavigationOptions).not.toHaveBeenCalled();
  });

  it('keeps tab params route-local and hosts actions only on the focused route', () => {
    const first = { ...routeProps(), focused: false };
    const secondBase = routeProps('bridge');
    const second = {
      ...secondBase,
      route: { ...secondBase.route, key: 'swap-b' },
    };
    const view = render(
      <>
        <RouteWithHeader context={first} />
        <RouteWithHeader context={second} />
      </>,
    );
    layoutPagers(view);
    const firstView = within(view.getByTestId('swap-a'));
    const secondView = within(view.getByTestId('swap-b'));
    expect(firstView.queryByTestId('swap-header-actions')).toBeNull();
    expect(
      firstView.getByTestId('swap-scene').props.accessibilityState.selected,
    ).toBe(false);
    expect(secondView.getByTestId('bridge-header-actions')).toBeTruthy();
    expect(
      secondView.getByTestId('bridge-scene').props.accessibilityState.selected,
    ).toBe(true);
    expect(view.getAllByTestId('account-modal-host')).toHaveLength(1);

    fireEvent.press(secondView.getByText('Swap'));
    expect(second.navigation.setParams).toHaveBeenCalledWith({
      activeTab: 'swap',
    });
    expect(first.navigation.setParams).not.toHaveBeenCalled();
    // Navigation owns the update; a press does not create a second local tab state.
    expect(secondView.getByTestId('bridge-header-actions')).toBeTruthy();
    view.rerender(
      <>
        <RouteWithHeader context={{ ...first, focused: true }} />
        <RouteWithHeader
          context={{
            ...second,
            focused: false,
            route: { ...second.route, params: { activeTab: 'swap' } },
          }}
        />
      </>,
    );
    settle();
    expect(firstView.getByTestId('swap-header-actions')).toBeTruthy();
    expect(
      firstView.getByTestId('swap-scene').props.accessibilityState.selected,
    ).toBe(true);
    expect(secondView.queryByTestId('swap-header-actions')).toBeNull();
    expect(
      secondView.getByTestId('swap-scene', hidden).props.accessibilityState
        .selected,
    ).toBe(false);
    expect(view.getAllByTestId('account-modal-host')).toHaveLength(1);
    fireEvent.press(firstView.getByText('Swap'));
    expect(first.navigation.setParams).not.toHaveBeenCalled();
  });
});
