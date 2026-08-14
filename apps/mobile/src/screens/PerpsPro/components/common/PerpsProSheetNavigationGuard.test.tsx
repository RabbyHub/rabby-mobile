import { act, render, renderHook, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

const mockSetOptions = jest.fn();
let mockRequestBack: (() => boolean) | null = null;
let mockEdgeOnEnd:
  | ((event: { translationX: number; velocityX: number }) => void)
  | null = null;

jest.mock('@/core/native/utils', () => ({ IS_IOS: true }));

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({ setOptions: mockSetOptions }),
}));

jest.mock('@/hooks/useAppGesture', () => ({
  useHandleBackPressClosable: (requestBack: () => boolean) => {
    mockRequestBack = requestBack;
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
    Gesture: { Pan: () => gesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({ children }: { children: React.ReactNode }) => {
    const ReactModule = require('react');
    const { View: NativeView } = require('react-native');
    return ReactModule.createElement(
      NativeView,
      { testID: 'full-window-overlay' },
      children,
    );
  },
}));

const {
  PerpsProSheetGlobalEdgeTarget,
  PerpsProSheetNavigationBoundary,
  resetPerpsProSheetNavigationGuardForTests,
  shouldDismissPerpsProSheetFromEdge,
  usePerpsProSheetNavigationHost,
  usePerpsProSheetNavigationRegistration,
} =
  require('./PerpsProSheetNavigationGuard') as typeof import('./PerpsProSheetNavigationGuard');

describe('PerpsProSheetNavigationGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestBack = null;
    mockEdgeOnEnd = null;
    resetPerpsProSheetNavigationGuardForTests();
  });

  it('disables route swipe while any Pro sheet is active and restores it', () => {
    const Host = () => {
      usePerpsProSheetNavigationHost();
      return null;
    };
    const view = render(
      <>
        <Host />
        <PerpsProSheetNavigationBoundary active dismiss={jest.fn()}>
          <View />
        </PerpsProSheetNavigationBoundary>
      </>,
    );

    expect(mockSetOptions).toHaveBeenCalledWith({ gestureEnabled: false });

    view.rerender(<Host />);

    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(mockRequestBack?.()).toBe(true);
  });

  it('routes Back and edge swipe only to the topmost dismissible sheet', () => {
    const lowerDismiss = jest.fn();
    const upperDismiss = jest.fn();
    const lower = renderHook(() =>
      usePerpsProSheetNavigationRegistration({
        active: true,
        dismiss: lowerDismiss,
      }),
    );
    const upper = renderHook(() =>
      usePerpsProSheetNavigationRegistration({
        active: true,
        dismiss: upperDismiss,
      }),
    );
    renderHook(() => usePerpsProSheetNavigationHost());
    render(<PerpsProSheetGlobalEdgeTarget />);

    expect(
      screen.getByTestId('perps-pro-sheet-edge-gesture', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(mockRequestBack?.()).toBe(false);
    expect(upperDismiss).toHaveBeenCalledTimes(1);
    expect(lowerDismiss).not.toHaveBeenCalled();

    act(() => mockEdgeOnEnd?.({ translationX: 80, velocityX: 0 }));
    expect(upperDismiss).toHaveBeenCalledTimes(2);
    expect(lowerDismiss).not.toHaveBeenCalled();
    expect(
      shouldDismissPerpsProSheetFromEdge({
        translationX: 20,
        velocityX: 200,
      }),
    ).toBe(false);

    act(() => {
      lower.unmount();
      upper.unmount();
    });
  });

  it('keeps a pending sheet modal and blocks route Back', () => {
    const dismiss = jest.fn();
    renderHook(() =>
      usePerpsProSheetNavigationRegistration({
        active: true,
        dismiss,
        dismissible: false,
      }),
    );
    renderHook(() => usePerpsProSheetNavigationHost());

    expect(mockRequestBack?.()).toBe(false);
    expect(dismiss).not.toHaveBeenCalled();
  });
});
