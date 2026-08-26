import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard } from 'react-native';

const mockTriggerImpact = jest.fn();

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/common', () => ({
  triggerImpact: (...args: unknown[]) => mockTriggerImpact(...args),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@rneui/themed', () => ({
  Slider: (props: object) => {
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
