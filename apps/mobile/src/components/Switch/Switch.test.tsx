import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { RabbySwitch } from './Switch';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('react-use/lib/usePrevious', () => () => undefined);

describe('RabbySwitch', () => {
  beforeEach(() => {
    jest.spyOn(Animated, 'parallel').mockReturnValue({
      start: (callback?: () => void) => callback?.(),
      stop: jest.fn(),
      reset: jest.fn(),
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders switch accessibility state from the controlled value', () => {
    render(<RabbySwitch value testID="switch" />);

    expect(screen.getByRole('switch').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it('requests the opposite value when pressed', () => {
    const onValueChange = jest.fn();
    const onPress = jest.fn();

    render(
      <RabbySwitch
        value={false}
        onPress={onPress}
        onValueChange={onValueChange}
        testID="switch"
      />,
    );

    fireEvent.press(screen.getByTestId('switch'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not request value changes while disabled', () => {
    const onValueChange = jest.fn();

    render(
      <RabbySwitch
        disabled
        value={false}
        onValueChange={onValueChange}
        testID="switch"
      />,
    );

    fireEvent.press(screen.getByTestId('switch'));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch').props.accessibilityState).toEqual(
      expect.objectContaining({
        disabled: true,
        checked: false,
      }),
    );
  });

  it('renders the active or inactive label from the controlled value', () => {
    const { rerender } = render(
      <RabbySwitch value activeText="Enabled" inActiveText="Disabled" />,
    );

    expect(screen.getByText('Enabled')).toBeTruthy();
    expect(screen.queryByText('Disabled')).toBeNull();

    rerender(
      <RabbySwitch
        value={false}
        activeText="Enabled"
        inActiveText="Disabled"
      />,
    );

    expect(screen.getByText('Disabled')).toBeTruthy();
    expect(screen.queryByText('Enabled')).toBeNull();
  });
});
