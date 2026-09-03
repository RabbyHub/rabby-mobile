import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/assets2024/icons/perps/PerpsProAmountUnitSwitch.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('./PerpsProDecimalTextInput', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    PerpsProDecimalTextInput: ReactModule.forwardRef(
      (props: object, ref: unknown) =>
        ReactModule.createElement(TextInput, {
          ...props,
          ref,
          testID: 'mock-price-input',
        }),
    ),
  };
});

jest.mock('./PerpsProTradePrimitives', () => ({
  getPerpsProTradeSelectFontStyle: () => ({}),
}));

jest.mock('./usePerpsProPriceFillAnimation', () => ({
  PERPS_PRO_PRICE_FILL_ANIMATION: {},
  PerpsProAnimatedPriceTextInput: require('react-native').TextInput,
  usePerpsProPriceFillAnimation: () => ({}),
}));

import { PerpsProTradePriceField } from './PerpsProTradePriceField';

const renderField = (onPressValue?: () => void) =>
  render(
    <PerpsProTradePriceField
      label="Price(USDC)"
      maxDecimals={5}
      onChangeText={jest.fn()}
      onPressValue={onPressValue}
      value="60000"
    />,
  );

describe('PerpsProTradePriceField', () => {
  it('leaves the ordinary editable lane to the native input responder', () => {
    renderField();

    const field = screen.getByTestId('perps-pro-trade-price-field');
    const valueLane = field.children[0];
    expect(valueLane.props.onStartShouldSetResponder).toBeUndefined();
    expect(screen.getByTestId('mock-price-input').props.pointerEvents).toBe(
      'auto',
    );
  });

  it('uses a press responder only when the value has an explicit action', () => {
    const onPressValue = jest.fn();
    renderField(onPressValue);

    const field = screen.getByTestId('perps-pro-trade-price-field');
    const valueLane = field.children[0];
    expect(valueLane.props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('mock-price-input').props.pointerEvents).toBe(
      'none',
    );
    fireEvent.press(valueLane);
    expect(onPressValue).toHaveBeenCalledTimes(1);
  });
});
