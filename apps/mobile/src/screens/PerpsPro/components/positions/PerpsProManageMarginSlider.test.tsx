import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockSliderHapticComplete = jest.fn();
const mockSliderHapticOptions = jest.fn();
const mockSliderHapticStart = jest.fn();
const mockSliderHapticValueChange = jest.fn();

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
jest.mock('../common/usePerpsProSliderHaptics', () => ({
  usePerpsProSliderHaptics: (options: object) => {
    mockSliderHapticOptions(options);
    return {
      onSlidingComplete: mockSliderHapticComplete,
      onSlidingStart: mockSliderHapticStart,
      onValueChange: mockSliderHapticValueChange,
    };
  },
}));

import { PerpsProManageMarginSlider } from './PerpsProManageMarginSlider';

describe('PerpsProManageMarginSlider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses one token-aware 32/2/16 control with aligned progress rails', () => {
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
      screen.queryByTestId('perps-pro-manage-margin-slider-endpoints'),
    ).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-progress').props
          .style,
      ).width,
    ).toBe('25%');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-thumb').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      borderColor: 'neutral-title-1',
      height: 16,
      left: '25%',
      width: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-progress-rail').props
          .style,
      ),
    ).toMatchObject({ left: 8, right: 8, top: 15 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-thumb-rail').props
          .style,
      ),
    ).toMatchObject({ left: 0, right: 16, top: 8 });
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

    fireEvent(screen.getByTestId('native-margin-slider'), 'valueChange', 11);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(mockSliderHapticValueChange).toHaveBeenCalledTimes(1);
  });

  it('keeps its visual presentation unchanged when interaction is locked', () => {
    const props = {
      maximum: '30',
      minimum: '10',
      onValueChange: jest.fn(),
      value: '15',
    };
    const { rerender } = render(
      <PerpsProManageMarginSlider {...props} dimWhenDisabled={false} />,
    );
    const beforeContainerStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-manage-margin-slider').props.style,
    );
    const beforeThumbStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-manage-margin-slider-thumb').props.style,
    );

    rerender(
      <PerpsProManageMarginSlider
        {...props}
        dimWhenDisabled={false}
        disabled
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider').props.style,
      ),
    ).toEqual(beforeContainerStyle);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-slider-thumb').props.style,
      ),
    ).toEqual(beforeThumbStyle);
    expect(screen.getByTestId('native-margin-slider').props).toMatchObject({
      allowTouchTrack: false,
      disabled: true,
    });

    fireEvent(screen.getByTestId('native-margin-slider'), 'valueChange', 20);
    expect(props.onValueChange).not.toHaveBeenCalled();
    expect(mockSliderHapticValueChange).not.toHaveBeenCalled();
  });

  it('normalizes haptics to slider travel across different amount ranges', () => {
    const onValueChange = jest.fn();
    const { rerender } = render(
      <PerpsProManageMarginSlider
        maximum="110"
        minimum="10"
        onValueChange={onValueChange}
        value="60"
      />,
    );

    expect(mockSliderHapticOptions).toHaveBeenLastCalledWith({
      disabled: false,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: 50,
    });
    const largeRangeSlider = screen.getByTestId('native-margin-slider');
    largeRangeSlider.props.onSlidingStart(35);
    largeRangeSlider.props.onValueChange(90);
    largeRangeSlider.props.onSlidingComplete(90);
    expect(mockSliderHapticStart).toHaveBeenLastCalledWith(25);
    expect(mockSliderHapticValueChange).toHaveBeenLastCalledWith(80);
    expect(mockSliderHapticComplete).toHaveBeenCalledTimes(1);

    rerender(
      <PerpsProManageMarginSlider
        maximum="10.5"
        minimum="10"
        onValueChange={onValueChange}
        value="10.25"
      />,
    );
    expect(mockSliderHapticOptions).toHaveBeenLastCalledWith({
      disabled: false,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: 50,
    });
    screen.getByTestId('native-margin-slider').props.onValueChange(10.4);
    expect(mockSliderHapticValueChange.mock.lastCall?.[0]).toBeCloseTo(80);
    expect(onValueChange).toHaveBeenLastCalledWith('10.4');
  });
});
