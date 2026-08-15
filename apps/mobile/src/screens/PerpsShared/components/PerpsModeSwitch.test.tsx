import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { FontNames } from '@/core/utils/fonts';
import { PerpsModeSwitch } from './PerpsModeSwitch';

jest.mock('@/components/Typography', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => 'New' }),
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
    expect(
      StyleSheet.flatten(screen.getByText('Perps').props.style),
    ).toMatchObject({
      fontFamily: FontNames.sf_pro,
      fontSize: 18,
      fontWeight: '700',
      includeFontPadding: false,
      lineHeight: 22,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Pro').props.style),
    ).toMatchObject({
      fontFamily: FontNames.sf_pro,
      fontSize: 14,
      fontWeight: '500',
      includeFontPadding: false,
      lineHeight: 18,
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

  it('lets only the Pro target own the remaining Simple Header corridor', () => {
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        extendProHitAreaRight
        onSelectMode={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-mode-simple').props.style).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-switch').props.style),
    ).toMatchObject({
      flex: 1,
      height: 26,
      minWidth: 0,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-pro').props.style),
    ).toMatchObject({
      alignItems: 'flex-start',
      flex: 1,
      height: '100%',
      justifyContent: 'center',
    });
  });

  it('reports press intent only for the enabled target before selection', () => {
    const onPressInMode = jest.fn();
    const onPressOutMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        onPressInMode={onPressInMode}
        onPressOutMode={onPressOutMode}
        onSelectMode={jest.fn()}
      />,
    );

    fireEvent(screen.getByTestId('perps-mode-pro'), 'pressIn');
    fireEvent(screen.getByTestId('perps-mode-pro'), 'pressOut');

    expect(onPressInMode).toHaveBeenCalledWith('pro');
    expect(onPressOutMode).toHaveBeenCalledWith('pro');
  });

  it('renders the Figma New badge without changing the Pro press target', () => {
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        extendProHitAreaRight
        onSelectMode={jest.fn()}
        showProNewBadge
      />,
    );

    expect(screen.getByText('New')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-pro-new-badge').props.style),
    ).toMatchObject({
      backgroundColor: 'red-light-1',
      borderRadius: 4,
      left: 16,
      paddingHorizontal: 2,
      position: 'absolute',
      top: -10,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-pro').props.style),
    ).toMatchObject({ flex: 1, height: '100%' });
  });
});
