import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/assets2024/icons/common/checkbox-empty-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, checkboxVariant: 'empty' });
});

jest.mock('@/assets2024/icons/common/checkbox-filled-brand.svg', () => {
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
  it('uses the canonical 24px filled checkbox and preserves row semantics', () => {
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
    ).toMatchObject({ checkboxVariant: 'filled', height: 24, width: 24 });

    fireEvent.press(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('uses the canonical empty checkbox with the Pro secondary token', () => {
    render(
      <PerpsProInfoControls
        actionLabel="Cancel All"
        hideOtherSymbols={false}
        onToggleHideOtherSymbols={jest.fn()}
        testID="controls"
      />,
    );

    expect(
      screen.getByTestId('perps-pro-info-filter-checkbox-icon').props,
    ).toMatchObject({
      checkboxVariant: 'empty',
      color: 'neutral-secondary',
      height: 24,
      width: 24,
    });
  });
});
