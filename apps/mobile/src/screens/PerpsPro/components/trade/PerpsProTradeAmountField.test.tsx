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

  it('matches the 211x40 Figma field geometry and unit typography', () => {
    render(
      <PerpsProTradeAmountField
        label="Amount(USDT)"
        maxDecimals={2}
        unit="USDT"
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
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-amount-unit').props.style,
      ),
    ).toMatchObject({
      borderLeftWidth: 1,
      gap: 2,
      height: 24,
      paddingLeft: 6,
      paddingRight: 4,
      width: 52,
    });
    expect(
      StyleSheet.flatten(screen.getByText('USDT').props.style),
    ).toMatchObject({
      ...getPerpsProTradeControlMediumTextStyle(Platform.OS),
      fontSize: 12,
      lineHeight: 16,
      width: 34,
    });
    expect(
      screen.getByTestId('perps-pro-trade-amount-unit-switch').props,
    ).toMatchObject({ height: 10, width: 10 });
  });
});
