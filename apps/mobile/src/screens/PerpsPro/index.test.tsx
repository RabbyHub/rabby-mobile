import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsProScreen } from './index';

const mockSetOptions = jest.fn();

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
  return {
    useRabbyAppNavigation: () => ({
      setOptions: mockSetOptions,
    }),
  };
});

jest.mock('./scene/PerpsProScene', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsProScene: ({
      isModeSwitching,
      onSwitchToSimple,
    }: {
      isModeSwitching: boolean;
      onSwitchToSimple: () => void;
    }) =>
      ReactModule.createElement(Pressable, {
        accessibilityLabel: 'pro',
        accessibilityState: { disabled: isModeSwitching },
        disabled: isModeSwitching,
        onPress: onSwitchToSimple,
        testID: 'perps-pro-scene',
      }),
  };
});

describe('PerpsProScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owns the navigation header and delegates the Simple action to its scene', () => {
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
    expect(screen.getByTestId('perps-pro-scene').props.accessibilityLabel).toBe(
      'pro',
    );

    fireEvent.press(screen.getByTestId('perps-pro-scene'));
    expect(onSwitchToSimple).toHaveBeenCalledTimes(1);
  });

  it('disables the shared switch while the mode preference is saving', () => {
    const screen = render(
      <PerpsProScreen isModeSwitching onSwitchToSimple={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-scene').props.accessibilityState,
    ).toEqual({ disabled: true });
  });
});
