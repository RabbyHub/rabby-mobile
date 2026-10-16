import React from 'react';
import { render } from '@testing-library/react-native';
import { TouchableOpacity, View } from 'react-native';
import { TouchableOpacity as RNGHTouchableOpacity } from 'react-native-gesture-handler';

import { CustomTouchableOpacity } from './CustomTouchableOpacity';

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    TouchableOpacity: function MockRNGHTouchableOpacity(props: object) {
      return React.createElement(View, props);
    },
    Pressable: View,
  };
});

function createTouchEvent(pageX: number, pageY: number) {
  let defaultPrevented = false;

  return {
    nativeEvent: { pageX, pageY },
    preventDefault: jest.fn(() => {
      defaultPrevented = true;
    }),
    isDefaultPrevented: () => defaultPrevented,
  };
}

// Component coverage only: drive the callbacks supplied to each native
// touchable. Native hit testing, gesture arbitration and navigation need device
// validation; this suite does not simulate those boundaries.
describe('CustomTouchableOpacity', () => {
  it('keeps RN TouchableOpacity as the default', () => {
    const screen = render(<CustomTouchableOpacity testID="button" />);

    expect(screen.UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    expect(screen.UNSAFE_queryByType(RNGHTouchableOpacity)).toBeNull();
  });

  it('selects RNGH only when explicitly requested', () => {
    const screen = render(
      <CustomTouchableOpacity as="RNGHTouchableOpacity" testID="button" />,
    );

    expect(screen.UNSAFE_getByType(RNGHTouchableOpacity)).toBeTruthy();
    expect(screen.UNSAFE_queryByType(TouchableOpacity)).toBeNull();
  });

  it.each([undefined, 'RNGHTouchableOpacity'] as const)(
    'preserves shared props and callbacks for as=%s',
    as => {
      const onPressIn = jest.fn();
      const onPressOut = jest.fn();
      const onPress = jest.fn();
      const onLongPress = jest.fn();
      const style = { padding: 12 };
      const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
      const screen = render(
        <CustomTouchableOpacity
          as={as}
          testID="button"
          accessibilityLabel="Back"
          style={style}
          hitSlop={hitSlop}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onPress}
          onLongPress={onLongPress}>
          <View testID="child" />
        </CustomTouchableOpacity>,
      );
      const button = screen.UNSAFE_getByType(
        as === 'RNGHTouchableOpacity' ? RNGHTouchableOpacity : TouchableOpacity,
      );

      expect(button.props).toMatchObject({
        activeOpacity: 0.8,
        accessibilityLabel: 'Back',
        testID: 'button',
        style,
        hitSlop,
        onLongPress,
      });
      expect(screen.getByTestId('child')).toBeTruthy();

      const start = createTouchEvent(100, 200);
      const release = createTouchEvent(100, 200);
      button.props.onPressIn(start);
      button.props.onPressOut(release);
      button.props.onPress(release);

      expect(onPressIn).toHaveBeenCalledTimes(1);
      expect(onPressIn).toHaveBeenCalledWith(start);
      expect(onPressOut).toHaveBeenCalledTimes(1);
      expect(onPressOut).toHaveBeenCalledWith(release);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith(release);
    },
  );

  it.each([undefined, 'RNGHTouchableOpacity'] as const)(
    'preserves an explicit opacity and disabled prop for as=%s',
    as => {
      const screen = render(
        <CustomTouchableOpacity as={as} activeOpacity={0.4} disabled />,
      );
      const button = screen.UNSAFE_getByType(
        as === 'RNGHTouchableOpacity' ? RNGHTouchableOpacity : TouchableOpacity,
      );

      expect(button.props.activeOpacity).toBe(0.4);
      expect(button.props.disabled).toBe(true);
    },
  );

  it.each([
    [0, 0],
    [10, 0],
    [-10, 0],
    [0, 10],
    [0, -10],
    [10, 10],
    [-10, -10],
  ])('allows RN release displacement (%s, %s) within each axis', (dx, dy) => {
    const onPress = jest.fn();
    const screen = render(<CustomTouchableOpacity onPress={onPress} />);
    const button = screen.UNSAFE_getByType(TouchableOpacity);
    const start = createTouchEvent(100, 200);
    const release = createTouchEvent(100 + dx, 200 + dy);

    button.props.onPressIn(start);
    button.props.onPressOut(release);
    button.props.onPress(release);

    expect(release.preventDefault).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(release);
  });

  it.each([
    [11, 0],
    [-11, 0],
    [0, 11],
    [0, -11],
  ])('cancels RN release displacement (%s, %s) over either axis', (dx, dy) => {
    const onPress = jest.fn();
    const onPressOut = jest.fn();
    const screen = render(
      <CustomTouchableOpacity onPress={onPress} onPressOut={onPressOut} />,
    );
    const button = screen.UNSAFE_getByType(TouchableOpacity);
    const start = createTouchEvent(100, 200);
    const release = createTouchEvent(100 + dx, 200 + dy);

    button.props.onPressIn(start);
    // Use the same release event so preventDefault is observable by onPress.
    button.props.onPressOut(release);
    button.props.onPress(release);

    expect(onPressOut).toHaveBeenCalledWith(release);
    expect(release.preventDefault).toHaveBeenCalledTimes(1);
    expect(release.isDefaultPrevented()).toBe(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('accepts the eventless callbacks used by RNGH touchables', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const onPress = jest.fn();
    const screen = render(
      <CustomTouchableOpacity
        as="RNGHTouchableOpacity"
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
      />,
    );
    const button = screen.UNSAFE_getByType(RNGHTouchableOpacity);

    button.props.onPressIn();
    button.props.onPressOut();
    button.props.onPress();

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledWith(undefined);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledWith(undefined);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(undefined);
  });
});
