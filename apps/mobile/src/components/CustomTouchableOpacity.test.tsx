import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import {
  CustomTouchableOpacity,
  getViewComponentByAs,
} from './CustomTouchableOpacity';

jest.mock('react-native-gesture-handler', () => {
  const ReactNative = jest.requireActual('react-native');

  return {
    Pressable: ReactNative.Pressable,
    TouchableOpacity: ReactNative.TouchableOpacity,
  };
});

function makeTouchEvent(x: number, y: number) {
  return {
    nativeEvent: {
      pageX: x,
      pageY: y,
    },
    preventDefault: jest.fn(),
    isDefaultPrevented: jest.fn(() => false),
  };
}

describe('CustomTouchableOpacity', () => {
  it('uses the requested touchable implementation', () => {
    const ReactNative = jest.requireActual('react-native');

    expect(getViewComponentByAs()).toBe(ReactNative.TouchableOpacity);
    expect(getViewComponentByAs('TouchableOpacity')).toBe(
      ReactNative.TouchableOpacity,
    );
    expect(getViewComponentByAs('RNGHTouchableOpacity')).toBe(
      ReactNative.TouchableOpacity,
    );
  });

  it('calls press handlers for a stable tap', () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const { getByTestId } = render(
      <CustomTouchableOpacity
        testID="touchable"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      />,
    );
    const touchable = getByTestId('touchable');
    const pressInEvent = makeTouchEvent(10, 10);
    const pressOutEvent = makeTouchEvent(15, 19);

    fireEvent(touchable, 'pressIn', pressInEvent);
    fireEvent(touchable, 'pressOut', pressOutEvent);
    fireEvent(touchable, 'press', pressOutEvent);

    expect(onPressIn).toHaveBeenCalledWith(pressInEvent);
    expect(onPressOut).toHaveBeenCalledWith(pressOutEvent);
    expect(pressOutEvent.preventDefault).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledWith(pressOutEvent);
  });

  it('prevents press after the finger moves outside the tap threshold', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <CustomTouchableOpacity testID="touchable" onPress={onPress} />,
    );
    const touchable = getByTestId('touchable');
    const pressOutEvent = makeTouchEvent(25, 10);

    fireEvent(touchable, 'pressIn', makeTouchEvent(10, 10));
    fireEvent(touchable, 'pressOut', pressOutEvent);
    pressOutEvent.isDefaultPrevented.mockReturnValue(true);
    fireEvent(touchable, 'press', pressOutEvent);

    expect(pressOutEvent.preventDefault).toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
