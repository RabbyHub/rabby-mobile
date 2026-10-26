import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';

const mockTriggerImpact = jest.fn();

jest.mock('@/assets2024/icons/perps/PerpsProTradeAmountSliderThumb.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, props);
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

jest.mock('@/utils/common', () => ({
  triggerImpact: (...args: unknown[]) => mockTriggerImpact(...args),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@rneui/themed', () => ({
  Slider: (props: { thumbProps?: { children?: React.ReactNode } }) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(
      View,
      { ...props, testID: 'amount-slider-input' },
      props.thumbProps?.children,
    );
  },
}));

import { PerpsProTradeAmountSlider } from './PerpsProTradeAmountSlider';

describe('PerpsProTradeAmountSlider haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('moves the design SVG inside the existing transparent thumb', () => {
    render(<PerpsProTradeAmountSlider onChange={jest.fn()} value={25} />);
    const slider = screen.getByTestId('amount-slider-input');
    const thumb = screen.getByTestId('perps-pro-trade-amount-slider-thumb');

    expect(thumb.props).toMatchObject({
      accessible: false,
      fill: 'neutral-bg-1',
      stroke: 'neutral-title-1',
      height: 13,
      width: 13,
      pointerEvents: 'none',
    });
    expect(StyleSheet.flatten(slider.props.thumbStyle)).toMatchObject({
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderWidth: 0,
      height: 13,
      width: 13,
    });
  });

  it.each([0, 1, 25, 50, 75, 99, 100])(
    'centers the percentage over the thumb at %s percent for narrow and wide tracks',
    value => {
      render(<PerpsProTradeAmountSlider onChange={jest.fn()} value={value} />);
      const slider = screen.getByTestId('amount-slider-input');
      act(() => slider.props.onSlidingStart(value));

      const tooltip = screen.getByTestId(
        'perps-pro-trade-amount-slider-tooltip',
      );
      const tooltipStyle = StyleSheet.flatten(tooltip.props.style);
      const tooltipTrack = StyleSheet.flatten(
        tooltip.parent?.parent?.props.style,
      );
      const sliderStyle = StyleSheet.flatten(slider.props.style);
      const thumbStyle = StyleSheet.flatten(slider.props.thumbStyle);
      expect(tooltip).toHaveTextContent(`${value}%`);
      expect(tooltipStyle.width).toBe(36);

      for (const width of [165, 193, 211, 248]) {
        const thumbCenter =
          sliderStyle.marginHorizontal +
          thumbStyle.width / 2 +
          ((width - 2 * sliderStyle.marginHorizontal - thumbStyle.width) *
            value) /
            100;
        const tooltipCenter =
          tooltipTrack.left +
          ((width - tooltipTrack.left - tooltipTrack.right) *
            parseFloat(tooltipStyle.left)) /
            100 +
          tooltipStyle.transform[0].translateX +
          tooltipStyle.width / 2;
        expect(tooltipCenter).toBeCloseTo(thumbCenter, 8);
      }

      act(() => slider.props.onSlidingComplete());
      expect(
        screen.queryByTestId('perps-pro-trade-amount-slider-tooltip'),
      ).toBeNull();
    },
  );

  it('triggers feedback when dragging to the next discrete unit', () => {
    const onChange = jest.fn();
    render(<PerpsProTradeAmountSlider onChange={onChange} value={0} />);
    const slider = screen.getByTestId('amount-slider-input');

    act(() => {
      slider.props.onSlidingStart(0);
      slider.props.onValueChange(1);
    });

    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(
      screen.getByTestId('perps-pro-trade-amount-slider-tooltip'),
    ).toBeTruthy();
  });

  it('does not add feedback to accessibility adjustments', () => {
    const onChange = jest.fn();
    const dismissSpy = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(jest.fn());
    render(<PerpsProTradeAmountSlider onChange={onChange} value={25} />);

    fireEvent(
      screen.getByTestId('perps-pro-trade-amount-slider'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );

    expect(onChange).toHaveBeenCalledWith(50);
    expect(mockTriggerImpact).not.toHaveBeenCalled();
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it('does not trigger feedback for the non-interactive skeleton usage', () => {
    render(<PerpsProTradeAmountSlider value={0} />);
    const slider = screen.getByTestId('amount-slider-input');

    act(() => {
      slider.props.onSlidingStart(0);
      slider.props.onValueChange(100);
    });

    expect(mockTriggerImpact).not.toHaveBeenCalled();
  });
});
