import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsModeSwitch } from './PerpsModeSwitch';

jest.mock('@/components/Typography', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {
      activeText: {},
      container: {},
      inactiveText: {},
    },
  }),
}));

describe('PerpsModeSwitch', () => {
  it('marks the active label selected and only invokes the inactive mode', () => {
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch activeMode="simple" onSelectMode={onSelectMode} />,
    );

    expect(
      screen.getByTestId('perps-mode-simple').props.accessibilityState,
    ).toEqual({
      disabled: true,
      selected: true,
    });
    expect(
      screen.getByTestId('perps-mode-pro').props.accessibilityState,
    ).toEqual({
      disabled: false,
      selected: false,
    });

    fireEvent.press(screen.getByTestId('perps-mode-simple'));
    expect(onSelectMode).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('perps-mode-pro'));
    expect(onSelectMode).toHaveBeenCalledTimes(1);
    expect(onSelectMode).toHaveBeenCalledWith('pro');
  });

  it('disables both labels while a mode save is in flight', () => {
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch activeMode="pro" disabled onSelectMode={onSelectMode} />,
    );

    expect(
      screen.getByTestId('perps-mode-simple').props.accessibilityState,
    ).toEqual({
      disabled: true,
      selected: false,
    });
    expect(
      screen.getByTestId('perps-mode-pro').props.accessibilityState,
    ).toEqual({
      disabled: true,
      selected: true,
    });

    fireEvent.press(screen.getByTestId('perps-mode-simple'));
    expect(onSelectMode).not.toHaveBeenCalled();
  });
});
