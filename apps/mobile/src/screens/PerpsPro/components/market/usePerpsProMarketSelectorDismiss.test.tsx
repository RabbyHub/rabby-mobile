import { act, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

const mockParentSetOptions = jest.fn();
const mockNavigation = {
  getParent: () => ({ setOptions: mockParentSetOptions }),
};
let mockRequestBack: (() => boolean) | null = null;
let mockEdgeOnEnd:
  | ((event: { translationX: number; velocityX: number }) => void)
  | null = null;

jest.mock('@/core/native/utils', () => ({
  IS_IOS: true,
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
    mockRequestBack = null;
    mockEdgeOnEnd = null;
  });

  it('freezes open height, owns Back, and restores the parent gesture', () => {
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
    expect(mockParentSetOptions).toHaveBeenLastCalledWith({
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
    expect(mockParentSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: true,
    });
    expect(mockRequestBack?.()).toBe(true);
    expect(result.current.stableWindowHeight).toBe(512);

    act(() => {
      result.current.markPresent();
    });
    unmount();
    expect(mockParentSetOptions).toHaveBeenLastCalledWith({
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
});
