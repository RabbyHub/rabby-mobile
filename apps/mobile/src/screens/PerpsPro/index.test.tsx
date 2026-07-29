import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsProScreen } from './index';

const mockSetOptions = jest.fn();

jest.mock('@/assets2024/icons/perps/IconHyper.svg', () => 'MockIconHyper');

jest.mock('@/components2024/ScreenContainer/NormalScreenContainer', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ({
    children,
    noHeader,
    type,
  }: {
    children: React.ReactNode;
    noHeader?: boolean;
    type?: string;
  }) =>
    ReactModule.createElement(
      View,
      {
        accessibilityLabel: `${String(noHeader)}:${String(type)}`,
        testID: 'screen-container',
      },
      children,
    );
});

jest.mock('@/hooks/navigation', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    HeaderBackPressable: () =>
      ReactModule.createElement(View, { testID: 'back-button' }),
    useRabbyAppNavigation: () => ({
      setOptions: mockSetOptions,
    }),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {
      backButton: {},
      content: {},
      header: {},
      headerContent: {},
      modeSwitch: {},
    },
  }),
}));

jest.mock('../PerpsShared/components/PerpsModeSwitch', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsModeSwitch: ({
      activeMode,
      disabled,
      onSelectMode,
    }: {
      activeMode: 'simple' | 'pro';
      disabled?: boolean;
      onSelectMode: (mode: 'simple' | 'pro') => void;
    }) =>
      ReactModule.createElement(Pressable, {
        accessibilityLabel: activeMode,
        accessibilityState: { disabled },
        disabled,
        onPress: () => onSelectMode('simple'),
        testID: 'mode-switch',
      }),
  };
});

describe('PerpsProScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owns an in-page header and exposes only the Simple mode action', () => {
    const onSwitchToSimple = jest.fn();
    const screen = render(
      <PerpsProScreen
        isModeSwitching={false}
        onSwitchToSimple={onSwitchToSimple}
      />,
    );

    expect(mockSetOptions).toHaveBeenCalledWith({
      headerShown: false,
    });
    expect(
      screen.getByTestId('screen-container').props.accessibilityLabel,
    ).toBe('true:bg1');
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
    expect(screen.getByTestId('mode-switch').props.accessibilityLabel).toBe(
      'pro',
    );

    fireEvent.press(screen.getByTestId('mode-switch'));
    expect(onSwitchToSimple).toHaveBeenCalledTimes(1);
  });

  it('disables the shared switch while the mode preference is saving', () => {
    const screen = render(
      <PerpsProScreen isModeSwitching onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('mode-switch').props.accessibilityState).toEqual({
      disabled: true,
    });
  });
});
