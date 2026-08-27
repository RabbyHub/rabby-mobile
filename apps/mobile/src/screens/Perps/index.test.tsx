import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsOriginScreen } from './index';

const mockSetViewMode = jest.fn(async () => true);
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
let mockViewModeState = {
  hydrated: false,
  hasVisitedPro: false,
  viewMode: 'simple' as 'simple' | 'pro',
  savingMode: null as 'simple' | 'pro' | null,
  error: null as unknown,
  setViewMode: mockSetViewMode,
};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

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

jest.mock('./hooks/usePerpsViewMode', () => ({
  usePerpsViewMode: () => mockViewModeState,
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
    }: {
      isModeSwitching: boolean;
      onPressInPro?: () => void;
      onPressOutPro?: () => void;
      onRegionAlertLayout?: (event: object) => void;
      onSwitchToPro: () => void;
      showProNewBadge?: boolean;
    }) =>
      ReactModule.createElement(
        View,
        {
          accessibilityLabel: `new:${String(showProNewBadge)}`,
          testID: 'simple-scene',
        },
        ReactModule.createElement(Text, null, 'Simple scene'),
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
    }: {
      initialRegionAlertLayout?: { height: number; width: number } | null;
      isModeSwitching: boolean;
      onSwitchToSimple: () => void;
    }) =>
      ReactModule.createElement(
        View,
        {
          accessibilityLabel: initialRegionAlertLayout
            ? `${initialRegionAlertLayout.width}:${initialRegionAlertLayout.height}`
            : 'no-alert-layout',
          testID: 'pro-scene',
        },
        ReactModule.createElement(Text, null, 'Pro scene'),
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockRuntimeMounts = 0;
    mockRuntimeUnmounts = 0;
    mockMarketDataStatus = 'idle';
    mockRouteParams = undefined;
    mockNavigationListeners.clear();
    mockPortfolioBreakdownVisible = false;
    mockViewModeState = {
      hydrated: false,
      hasVisitedPro: false,
      viewMode: 'simple',
      savingMode: null,
      error: null,
      setViewMode: mockSetViewMode,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
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

    mockViewModeState = {
      ...mockViewModeState,
      hasVisitedPro: true,
    };
    screen.rerender(<PerpsOriginScreen />);
    expect(screen.getByTestId('simple-scene').props.accessibilityLabel).toBe(
      'new:false',
    );
  });

  it('switches mutually exclusive scenes without remounting the route Runtime', () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    const screen = render(<PerpsOriginScreen />);

    expect(screen.getByTestId('simple-scene')).toBeOnTheScreen();
    expect(screen.queryByTestId('pro-scene')).toBeNull();
    expect(mockRuntimeMounts).toBe(1);

    fireEvent(screen.getByTestId('simple-region-alert'), 'layout', {
      nativeEvent: { layout: { height: 52, width: 361, x: 16, y: 56 } },
    });

    fireEvent.press(screen.getByTestId('switch-to-pro'));
    expect(mockSetViewMode).toHaveBeenCalledWith('pro');
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(1);

    mockViewModeState = {
      ...mockViewModeState,
      viewMode: 'pro',
    };
    screen.rerender(<PerpsOriginScreen />);

    expect(screen.queryByTestId('simple-scene')).toBeNull();
    expect(screen.getByTestId('pro-scene')).toBeOnTheScreen();
    expect(screen.getByTestId('pro-scene').props.accessibilityLabel).toBe(
      '361:52',
    );
    expect(mockRuntimeMounts).toBe(1);
    expect(mockRuntimeUnmounts).toBe(0);

    fireEvent.press(screen.getByTestId('switch-to-simple'));
    expect(mockSetViewMode).toHaveBeenCalledWith('simple');
    expect(mockHidePortfolioBreakdown).toHaveBeenCalledTimes(2);
  });

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

  it('keeps the intent alive when press-out is followed by the committed switch', () => {
    jest.useFakeTimers();
    mockMarketDataStatus = 'success';
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
    };
    const screen = render(<PerpsOriginScreen />);
    const target = screen.getByTestId('switch-to-pro');

    fireEvent(target, 'pressIn');
    fireEvent(target, 'pressOut');
    fireEvent.press(target);
    act(() => jest.runOnlyPendingTimers());

    expect(mockSetViewMode).toHaveBeenCalledWith('pro');
    expect(mockCancelEntryIntent).not.toHaveBeenCalled();
  });

  it('disables the active scene switch while persistence is pending', () => {
    mockViewModeState = {
      ...mockViewModeState,
      hydrated: true,
      savingMode: 'pro',
    };
    const screen = render(<PerpsOriginScreen />);

    expect(
      screen.getByTestId('switch-to-pro').props.accessibilityState,
    ).toEqual({
      disabled: true,
    });
    fireEvent.press(screen.getByTestId('switch-to-pro'));
    expect(mockSetViewMode).not.toHaveBeenCalled();
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
