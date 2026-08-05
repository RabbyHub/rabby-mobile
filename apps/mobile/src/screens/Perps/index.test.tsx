import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsOriginScreen } from './index';

const mockSetOptions = jest.fn();
const mockSetViewMode = jest.fn(async () => true);
const mockUseEnsurePerpsRuntime = jest.fn();
let mockRuntimeMounts = 0;
let mockRuntimeUnmounts = 0;
let mockViewModeState = {
  hydrated: false,
  viewMode: 'simple' as 'simple' | 'pro',
  savingMode: null as 'simple' | 'pro' | null,
  error: null as unknown,
  setViewMode: mockSetViewMode,
};

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({
    setOptions: mockSetOptions,
  }),
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
      onSwitchToPro,
    }: {
      isModeSwitching: boolean;
      onSwitchToPro: () => void;
    }) =>
      ReactModule.createElement(
        View,
        { testID: 'simple-scene' },
        ReactModule.createElement(Text, null, 'Simple scene'),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: isModeSwitching },
          disabled: isModeSwitching,
          onPress: onSwitchToPro,
          testID: 'switch-to-pro',
        }),
      ),
  };
});

jest.mock('../PerpsPro', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    PerpsProScreen: ({
      isModeSwitching,
      onSwitchToSimple,
    }: {
      isModeSwitching: boolean;
      onSwitchToSimple: () => void;
    }) =>
      ReactModule.createElement(
        View,
        { testID: 'pro-scene' },
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
    mockViewModeState = {
      hydrated: false,
      viewMode: 'simple',
      savingMode: null,
      error: null,
      setViewMode: mockSetViewMode,
    };
  });

  it('keeps both scenes unmounted and hides the native header during hydration', () => {
    const screen = render(<PerpsOriginScreen />);

    expect(screen.queryByTestId('simple-scene')).toBeNull();
    expect(screen.queryByTestId('pro-scene')).toBeNull();
    expect(mockSetOptions).toHaveBeenCalledWith({
      headerShown: false,
    });
    expect(mockRuntimeMounts).toBe(1);
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

    fireEvent.press(screen.getByTestId('switch-to-pro'));
    expect(mockSetViewMode).toHaveBeenCalledWith('pro');

    mockViewModeState = {
      ...mockViewModeState,
      viewMode: 'pro',
    };
    screen.rerender(<PerpsOriginScreen />);

    expect(screen.queryByTestId('simple-scene')).toBeNull();
    expect(screen.getByTestId('pro-scene')).toBeOnTheScreen();
    expect(mockRuntimeMounts).toBe(1);
    expect(mockRuntimeUnmounts).toBe(0);

    fireEvent.press(screen.getByTestId('switch-to-simple'));
    expect(mockSetViewMode).toHaveBeenCalledWith('simple');
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
});
