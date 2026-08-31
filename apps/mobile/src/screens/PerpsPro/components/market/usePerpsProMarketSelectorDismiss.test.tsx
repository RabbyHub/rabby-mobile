import { act, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

const mockSetOptions = jest.fn();
const mockNavigation = {
  setOptions: mockSetOptions,
};
const mockPlatformState = { isIOS: true };
let mockRequestBack: (() => boolean) | null = null;
let mockEdgeOnEnd:
  | ((event: { translationX: number; velocityX: number }) => void)
  | null = null;

jest.mock('@/core/native/utils', () => ({
  get IS_IOS() {
    return mockPlatformState.isIOS;
  },
}));

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => mockNavigation,
}));

jest.mock('@/hooks/useAppGesture', () => ({
  useHandleBackPressClosable: (requestBack: () => boolean) => {
    mockRequestBack = requestBack;
    return { onHardwareBackHandler: jest.fn() };
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const gesture: Record<string, jest.Mock> = {};
  gesture.activeOffsetX = jest.fn(() => gesture);
  gesture.failOffsetY = jest.fn(() => gesture);
  gesture.runOnJS = jest.fn(() => gesture);
  gesture.onEnd = jest.fn(
    (
      callback: (event: { translationX: number; velocityX: number }) => void,
    ) => {
      mockEdgeOnEnd = callback;
      return gesture;
    },
  );
  return {
    Gesture: {
      Pan: () => gesture,
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('react-native-screens', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    FullWindowOverlay: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(
        NativeView,
        { testID: 'full-window-overlay' },
        children,
      ),
  };
});

const {
  PerpsProMarketSelectorDismissProvider,
  PerpsProMarketSelectorGestureContainer,
  shouldDismissPerpsProMarketSelectorFromEdge,
  usePerpsProMarketSelectorDismiss,
} =
  require('./usePerpsProMarketSelectorDismiss') as typeof import('./usePerpsProMarketSelectorDismiss');

describe('usePerpsProMarketSelectorDismiss', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformState.isIOS = true;
    mockRequestBack = null;
    mockEdgeOnEnd = null;
  });

  it('freezes open height, owns Back, and restores the current screen gesture', () => {
    const dismiss = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ windowHeight }) =>
        usePerpsProMarketSelectorDismiss({ dismiss, windowHeight }),
      { initialProps: { windowHeight: 852 } },
    );

    expect(result.current.stableWindowHeight).toBe(852);
    expect(mockRequestBack?.()).toBe(true);

    act(() => {
      result.current.markPresent();
    });
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: false,
    });

    rerender({ windowHeight: 512 });
    expect(result.current.stableWindowHeight).toBe(852);
    expect(mockRequestBack?.()).toBe(false);
    expect(dismiss).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.markDismissed();
    });
    rerender({ windowHeight: 512 });
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: true,
    });
    expect(mockRequestBack?.()).toBe(true);
    expect(result.current.stableWindowHeight).toBe(512);

    act(() => {
      result.current.markPresent();
    });
    unmount();
    expect(mockSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: true,
    });
  });

  it('dismisses only a deliberate rightward gesture from the iOS edge target', () => {
    const dismiss = jest.fn();
    render(
      <PerpsProMarketSelectorDismissProvider onDismiss={dismiss}>
        <PerpsProMarketSelectorGestureContainer>
          <View />
        </PerpsProMarketSelectorGestureContainer>
      </PerpsProMarketSelectorDismissProvider>,
    );

    expect(screen.getByTestId('full-window-overlay')).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-market-selector-edge-gesture', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      shouldDismissPerpsProMarketSelectorFromEdge({
        translationX: 20,
        velocityX: 200,
      }),
    ).toBe(false);

    act(() => {
      mockEdgeOnEnd?.({ translationX: 80, velocityX: 200 });
    });
    expect(dismiss).toHaveBeenCalledTimes(1);

    act(() => {
      mockEdgeOnEnd?.({ translationX: 20, velocityX: 800 });
    });
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it('adds no native container or edge target on Android', () => {
    mockPlatformState.isIOS = false;
    const dismiss = jest.fn();
    const { toJSON } = render(
      <PerpsProMarketSelectorDismissProvider onDismiss={dismiss}>
        <PerpsProMarketSelectorGestureContainer>
          <View testID="bottom-sheet-child" />
        </PerpsProMarketSelectorGestureContainer>
      </PerpsProMarketSelectorDismissProvider>,
    );

    expect(screen.queryByTestId('full-window-overlay')).toBeNull();
    expect(
      screen.queryByTestId('perps-pro-market-selector-edge-gesture', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(toJSON()).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({ testID: 'bottom-sheet-child' }),
      }),
    );
  });
});
