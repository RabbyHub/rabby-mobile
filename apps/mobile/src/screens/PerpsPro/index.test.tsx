import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsProScreen } from './index';

const mockSetOptions = jest.fn();
const mockPush = jest.fn();

jest.mock(
  '@/screens/PerpsProHistory/repository/perpsProHistoryRepository',
  () => ({
    isPerpsProHistorySdkSupported: () => true,
  }),
);

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
      push: mockPush,
      setOptions: mockSetOptions,
    }),
  };
});

jest.mock('./scene/PerpsProScene', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  return {
    PerpsProScene: ({
      historyEnabled,
      initialRegionAlertLayout,
      isModeSwitching,
      onOpenHistory,
      onSwitchToSimple,
    }: {
      historyEnabled: boolean;
      initialRegionAlertLayout?: { height: number; width: number } | null;
      isModeSwitching: boolean;
      onOpenHistory: (hasPendingFunding: boolean) => void;
      onSwitchToSimple: () => void;
    }) =>
      ReactModule.createElement(
        View,
        {
          accessibilityLabel: initialRegionAlertLayout
            ? `${initialRegionAlertLayout.width}:${initialRegionAlertLayout.height}`
            : 'no-alert-layout',
          testID: 'perps-pro-scene-wrapper',
        },
        ReactModule.createElement(Pressable, {
          accessibilityLabel: 'pro',
          accessibilityState: { disabled: isModeSwitching },
          disabled: isModeSwitching,
          onPress: onSwitchToSimple,
          testID: 'perps-pro-scene',
        }),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: !historyEnabled },
          disabled: !historyEnabled,
          onPress: () => onOpenHistory(false),
          testID: 'perps-pro-history',
        }),
        ReactModule.createElement(Pressable, {
          accessibilityState: { disabled: !historyEnabled },
          disabled: !historyEnabled,
          onPress: () => onOpenHistory(true),
          testID: 'perps-pro-history-pending',
        }),
      ),
  };
});

describe('PerpsProScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates mode and History actions while the outer route owns the header', () => {
    const onSwitchToSimple = jest.fn();
    const screen = render(
      <PerpsProScreen
        initialRegionAlertLayout={{ height: 52, width: 361 }}
        isModeSwitching={false}
        onSwitchToSimple={onSwitchToSimple}
      />,
    );

    expect(mockSetOptions).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('screen-container').props.accessibilityLabel,
    ).toBe('true:bg1');
    expect(screen.getByTestId('perps-pro-scene').props.accessibilityLabel).toBe(
      'pro',
    );
    expect(
      screen.getByTestId('perps-pro-scene-wrapper').props.accessibilityLabel,
    ).toBe('361:52');

    fireEvent.press(screen.getByTestId('perps-pro-scene'));
    expect(onSwitchToSimple).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('perps-pro-history'));
    expect(mockPush).toHaveBeenCalledWith('StackTransaction', {
      screen: 'PerpsProHistory',
    });
  });

  it('disables the shared switch while the mode preference is saving', () => {
    const screen = render(
      <PerpsProScreen isModeSwitching onSwitchToSimple={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-scene').props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('opens Transaction history when a funding operation is pending', () => {
    const screen = render(
      <PerpsProScreen isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-history-pending'));
    expect(mockPush).toHaveBeenCalledWith('StackTransaction', {
      params: { initialTab: 'transaction' },
      screen: 'PerpsProHistory',
    });
  });
});
