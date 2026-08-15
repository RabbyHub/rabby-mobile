import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock(
  '@/assets2024/icons/perps/PerpsProMarginSliderEndpoint.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsProMarginSliderThumb.svg',
  () => require('react-native').View,
);
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@rneui/themed', () => ({
  Slider: (props: object) => {
    const ReactModule = require('react');
    return ReactModule.createElement(require('react-native').View, {
      ...props,
      testID: 'native-margin-slider',
    });
  },
}));

import { PerpsProManageMarginSlider } from './PerpsProManageMarginSlider';

describe('PerpsProManageMarginSlider', () => {
  it('uses the exact 32/2/16 geometry and a two-decimal step', () => {
    render(
      <PerpsProManageMarginSlider
        maximum="30"
        minimum="10"
        onValueChange={jest.fn()}
        value="15"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider').props.style,
      ).height,
    ).toBe(32);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-track').props.style,
      ).height,
    ).toBe(2);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-endpoints').props
          .style,
      ).top,
    ).toBe(12.5);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-progress').props
          .style,
      ).width,
    ).toBe('25%');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-thumb').props.style,
      ).left,
    ).toBe('25%');
    expect(screen.getByTestId('native-margin-slider').props).toMatchObject({
      disabled: false,
      maximumValue: 30,
      minimumValue: 10,
      step: 0.01,
      value: 15,
    });
  });

  it('normalizes emitted values and disables a zero-width range', () => {
    const onValueChange = jest.fn();
    const { rerender } = render(
      <PerpsProManageMarginSlider
        maximum="30"
        minimum="10"
        onValueChange={onValueChange}
        value="15"
      />,
    );

    fireEvent(
      screen.getByTestId('native-margin-slider'),
      'valueChange',
      12.345,
    );
    expect(onValueChange).toHaveBeenCalledWith('12.35');

    rerender(
      <PerpsProManageMarginSlider
        maximum="10"
        minimum="10"
        onValueChange={onValueChange}
        value="10"
      />,
    );
    expect(screen.getByTestId('native-margin-slider').props.disabled).toBe(
      true,
    );
    expect(
      screen.getByTestId('perps-pro-manage-margin-slider').props
        .accessibilityState,
    ).toEqual({ disabled: true });
  });
});
