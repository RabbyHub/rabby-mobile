import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

let mockIsLight = true;

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
      styles: getStyle({ colors2024, isLight: mockIsLight }),
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
  beforeEach(() => {
    mockIsLight = true;
  });

  it('uses the approved input surfaces in both themes without changing the value', () => {
    const field = () => (
      <PerpsProTradeAmountField
        label="Amount(USDC)"
        maxDecimals={2}
        unit="USDC"
        value="12.34"
      />
    );
    const light = render(field());
    expect(screen.getByTestId('perps-pro-trade-amount-field')).toHaveStyle({
      backgroundColor: 'neutral-bg-0',
    });
    light.unmount();

    mockIsLight = false;
    render(field());
    expect(screen.getByTestId('perps-pro-trade-amount-field')).toHaveStyle({
      backgroundColor: 'neutral-bg-5',
    });
    expect(screen.getByTestId('amount-input').props.value).toBe('12.34');
  });

  it('preserves the complete editing value while enabling tabular input glyphs', () => {
    render(
      <PerpsProTradeAmountField
        label="Amount(USDC)"
        maxDecimals={2}
        unit="USDC"
        value="111111111111.11"
      />,
    );
    const input = screen.getByTestId('amount-input');
    expect(input.props.value).toBe('111111111111.11');
    const style = StyleSheet.flatten(input.props.style);
    expect(style.fontVariant).toEqual(['tabular-nums']);
  });
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

  it('matches the 211x42 Figma field and lets the unit grow within bounds', () => {
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
      gap: 4,
      height: 42,
      paddingHorizontal: 8,
    });
    const unitAreaStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-trade-amount-unit').props.style,
    );
    expect(unitAreaStyle).toMatchObject({
      borderLeftWidth: 1,
      flexShrink: 0,
      gap: 4,
      height: 26,
      maxWidth: 72,
      minWidth: 63,
      paddingLeft: 10,
    });
    expect(unitAreaStyle.width).toBeUndefined();
    expect(unitAreaStyle.paddingRight).toBe(4);

    const unitStyle = StyleSheet.flatten(screen.getByText('USDC').props.style);
    expect(unitStyle).toMatchObject({
      ...getPerpsProTradeControlMediumTextStyle(Platform.OS),
      flexShrink: 1,
      fontSize: 14,
      lineHeight: 18,
      minWidth: 34,
    });
    expect(unitStyle.width).toBeUndefined();
    expect(
      screen.getByTestId('perps-pro-trade-amount-unit-switch').props,
    ).toMatchObject({ height: 10, width: 10 });
  });
});
