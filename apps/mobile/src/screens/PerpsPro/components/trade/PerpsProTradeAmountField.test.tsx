import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/perps/PerpsProAmountUnitSwitch.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('./PerpsProDecimalTextInput', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    PerpsProDecimalTextInput: (props: object) =>
      ReactModule.createElement(TextInput, {
        ...props,
        testID: 'amount-input',
      }),
  };
});

import { getPerpsProTradeControlMediumTextStyle } from '../common/perpsProVisual';
import { PerpsProTradeAmountField } from './PerpsProTradeAmountField';

describe('PerpsProTradeAmountField', () => {
  it('keeps long Amount and unit labels on one tail-ellipsized line', () => {
    const view = render(
      <PerpsProTradeAmountField
        label="Amount(WTIOILUSDC)"
        maxDecimals={2}
        unit="WTIOILUSDC"
      />,
    );

    expect(
      screen.getByTestId('perps-pro-amount-placeholder').props,
    ).toMatchObject({
      ellipsizeMode: 'tail',
      numberOfLines: 1,
    });
    expect(screen.getByText('WTIOILUSDC').props).toMatchObject({
      ellipsizeMode: 'tail',
      numberOfLines: 1,
    });

    view.rerender(
      <PerpsProTradeAmountField
        label="Amount(WTIOILUSDC)"
        maxDecimals={2}
        unit="WTIOILUSDC"
        value="1"
      />,
    );
    expect(screen.getByTestId('perps-pro-amount-label').props).toMatchObject({
      ellipsizeMode: 'tail',
      numberOfLines: 1,
    });
  });

  it('matches the 211x40 Figma field and lets the unit grow within bounds', () => {
    render(
      <PerpsProTradeAmountField
        label="Amount(USDC)"
        maxDecimals={2}
        unit="USDC"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-amount-field').props.style,
      ),
    ).toMatchObject({
      borderRadius: 6,
      flexDirection: 'row',
      gap: 6,
      height: 40,
      paddingHorizontal: 8,
    });
    const unitAreaStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-trade-amount-unit').props.style,
    );
    expect(unitAreaStyle).toMatchObject({
      borderLeftWidth: 1,
      flexShrink: 0,
      gap: 2,
      height: 24,
      maxWidth: 72,
      minWidth: 52,
      paddingLeft: 5,
    });
    expect(unitAreaStyle.width).toBeUndefined();
    expect(unitAreaStyle.paddingRight).toBeUndefined();

    const unitStyle = StyleSheet.flatten(screen.getByText('USDC').props.style);
    expect(unitStyle).toMatchObject({
      ...getPerpsProTradeControlMediumTextStyle(Platform.OS),
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 16,
      minWidth: 34,
    });
    expect(unitStyle.width).toBeUndefined();
    expect(
      screen.getByTestId('perps-pro-trade-amount-unit-switch').props,
    ).toMatchObject({ height: 10, width: 10 });
  });
});
