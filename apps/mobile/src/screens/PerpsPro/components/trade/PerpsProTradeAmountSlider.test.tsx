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

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: { View: require('react-native').View },
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
  };
});

jest.mock('@/components/perps/PerpsGestureSlider', () => ({
  PerpsGestureSlider: (props: object) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, {
      ...props,
      testID: 'amount-slider-input',
    });
  },
}));

import { PerpsProTradeAmountSlider } from './PerpsProTradeAmountSlider';

describe('PerpsProTradeAmountSlider haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const layoutRail = (width: number) =>
    fireEvent(
      screen.getByTestId('perps-pro-trade-amount-slider-rail'),
      'layout',
      { nativeEvent: { layout: { width, height: 1, x: 0, y: 0 } } },
    );
  const translateXOf = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style).transform[0]
      .translateX;

  it('keeps the design SVG and the transparent gesture thumb geometry', () => {
    render(<PerpsProTradeAmountSlider onChange={jest.fn()} value={25} />);
    const slider = screen.getByTestId('amount-slider-input');

    expect(
      screen.getByTestId('perps-pro-trade-amount-slider-thumb').props,
    ).toMatchObject({
      accessible: false,
      fill: 'neutral-bg-1',
      stroke: 'neutral-title-1',
      height: 13,
      width: 13,
      pointerEvents: 'none',
    });
    expect(StyleSheet.flatten(slider.props.thumbStyle)).toMatchObject({
      backgroundColor: 'transparent',
      height: 13,
      width: 13,
    });
    expect(slider.props.progressValue).toEqual({ value: 25 });
  });

  it('draws track, thumb and tooltip from the gesture position, not the delayed value', () => {
    render(<PerpsProTradeAmountSlider onChange={jest.fn()} value={0} />);
    layoutRail(200);
    const slider = screen.getByTestId('amount-slider-input');

    // The UI-thread gesture mirror moves before the Trade form re-renders.
    slider.props.progressValue.value = 50;
    act(() => slider.props.onSlidingStart(0));

    expect(translateXOf('perps-pro-trade-amount-slider-thumb-position')).toBe(
      100,
    );
    expect(translateXOf('perps-pro-trade-amount-slider-active-track')).toBe(
      -100,
    );
    expect(translateXOf('perps-pro-trade-amount-slider-tooltip')).toBe(
      100 - 18,
    );
    const activePoints = screen
      .getAllByTestId('perps-pro-trade-amount-slider-point-active')
      .map(point => StyleSheet.flatten(point.props.style).opacity);
    expect(activePoints).toEqual([1, 1, 1, 0, 0]);

    act(() => slider.props.onSlidingComplete());
    expect(
      screen.queryByTestId('perps-pro-trade-amount-slider-tooltip'),
    ).toBeNull();
  });

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
