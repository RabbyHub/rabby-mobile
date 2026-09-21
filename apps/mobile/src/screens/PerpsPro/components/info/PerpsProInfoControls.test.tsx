import { PERPS_PRO_DIALOG_TOKENS } from '../common/perpsProDialogVisual';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/perps/PerpsProInfoCheckboxChecked.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, checkboxVariant: 'filled' });
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: () => 'Hide Other Symbols',
  }),
}));

import { PerpsProInfoControls } from './PerpsProInfoControls';

describe('PerpsProInfoControls', () => {
  it('uses the Pro 20px filled checkbox and preserves row semantics', () => {
    const onToggle = jest.fn();
    render(
      <PerpsProInfoControls
        actionLabel="Close All"
        hideOtherSymbols
        onToggleHideOtherSymbols={onToggle}
        testID="controls"
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toEqual({ checked: true });
    expect(
      screen.getByTestId('perps-pro-info-filter-checkbox-icon').props,
    ).toMatchObject({ checkboxVariant: 'filled', height: 20, width: 20 });

    fireEvent.press(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('uses the 16px empty checkbox inside a 20px frame', () => {
    render(
      <PerpsProInfoControls
        actionLabel="Cancel All"
        hideOtherSymbols={false}
        onToggleHideOtherSymbols={jest.fn()}
        testID="controls"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-info-filter-checkbox-icon').props.style,
      ),
    ).toMatchObject({
      borderColor: PERPS_PRO_DIALOG_TOKENS.checkboxBorder,
      borderWidth: 1.25,
      borderRadius: 4,
      height: 16,
      width: 16,
    });
    expect(
      StyleSheet.flatten(screen.getByRole('button').props.style),
    ).toMatchObject({
      borderRadius: 6,
      height: 26,
      minWidth: 64,
      paddingHorizontal: 8,
    });
  });
});
