import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  Platform,
  StyleSheet,
  TouchableNativeFeedback,
  TouchableOpacity,
} from 'react-native';

// Component unit tests guard prop routing and rendered style/state contracts.
// Android drawable invalidation itself requires the real-device comparison.
jest.mock('@/hooks/theme', () => ({
  useGetBinaryMode: () => 'light',
  useThemeColors: () => ({
    'blue-default': '#7084ff',
    'blue-disable': '#dbe0ff',
    'neutral-title2': '#ffffff',
    'neutral-bg1': '#ffffff',
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyles: unknown) => ({ getStyles }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (value: number) => value,
}));

import { Button } from './Button';

const originalPlatform = Platform.OS;

describe('legacy Button native feedback', () => {
  beforeEach(() => {
    Platform.OS = 'android';
    jest
      .spyOn(Platform, 'select')
      .mockImplementation(options => options.android);
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it('uses foreground native feedback by default on Android', () => {
    render(<Button title="Proceed" />);

    expect(
      screen.UNSAFE_getByType(TouchableNativeFeedback).props.useForeground,
    ).toBe(true);
    expect(
      screen.getByRole('button').props.nativeForegroundAndroid,
    ).toBeTruthy();
    expect(
      screen.getByRole('button').props.nativeBackgroundAndroid,
    ).toBeUndefined();
  });

  it('preserves an explicit caller feedback override', () => {
    render(<Button title="Proceed" useForeground={false} />);

    expect(
      screen.UNSAFE_getByType(TouchableNativeFeedback).props.useForeground,
    ).toBe(false);
  });

  it('does not add native-feedback props to an explicit opacity touchable', () => {
    render(<Button title="Proceed" TouchableComponent={TouchableOpacity} />);

    expect(
      screen.UNSAFE_getByType(TouchableOpacity).props.useForeground,
    ).toBeUndefined();
    expect(screen.UNSAFE_queryByType(TouchableNativeFeedback)).toBeNull();
  });

  it('preserves the existing iOS opacity touchable', () => {
    Platform.OS = 'ios';
    jest
      .spyOn(Platform, 'select')
      .mockImplementation(options => options.ios ?? options.default);
    render(<Button title="Proceed" />);

    expect(
      screen.UNSAFE_getByType(TouchableOpacity).props.useForeground,
    ).toBeUndefined();
    expect(screen.UNSAFE_queryByType(TouchableNativeFeedback)).toBeNull();
  });

  it('keeps gradient buttons on opacity feedback without foreground props', () => {
    render(<Button title="Proceed" linearGradientProps={{}} />);

    expect(
      screen.UNSAFE_getByType(TouchableOpacity).props.useForeground,
    ).toBeUndefined();
    expect(screen.UNSAFE_queryByType(TouchableNativeFeedback)).toBeNull();
  });

  it('still blocks the press handler while loading', () => {
    const onPress = jest.fn();
    const view = render(<Button title="Proceed" loading onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();

    view.rerender(<Button title="Proceed" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('preserves disabled colors and press gating in both state directions', () => {
    const onPress = jest.fn();
    const view = render(<Button title="Proceed" disabled onPress={onPress} />);

    for (const disabled of [true, false, true, false]) {
      view.rerender(
        <Button title="Proceed" disabled={disabled} onPress={onPress} />,
      );
      const button = screen.getByRole('button', { disabled });
      expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(
        disabled ? '#dbe0ff' : '#7084ff',
      );
      expect(
        screen.UNSAFE_getByType(TouchableNativeFeedback).props.useForeground,
      ).toBe(true);
      fireEvent.press(button);
    }

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('preserves View title contrast, compact sizing, and dynamic caller styles', () => {
    const view = render(<Button title="View" />);

    for (const canExec of [false, true, false]) {
      view.rerender(
        <Button
          title="View"
          buttonStyle={[
            { width: 60, height: 26, borderRadius: 2 },
            canExec && { backgroundColor: 'rgba(134, 151, 255, 0.2)' },
          ]}
          titleStyle={[
            { fontSize: 18, lineHeight: 22, fontWeight: '500' },
            canExec && { color: '#7084ff' },
          ]}
        />,
      );
      const buttonStyle = StyleSheet.flatten(
        screen.getByRole('button').props.style,
      );
      expect(buttonStyle).toMatchObject({
        width: 60,
        height: 26,
        borderRadius: 2,
        backgroundColor: canExec ? 'rgba(134, 151, 255, 0.2)' : '#7084ff',
      });
      expect(
        StyleSheet.flatten(screen.getByText('View').props.style).color,
      ).toBe(canExec ? '#7084ff' : '#ffffff');
    }
  });
});
