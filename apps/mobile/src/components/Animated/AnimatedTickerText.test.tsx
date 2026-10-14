import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedTickerText from './AnimatedTickerText';

jest.mock('@/components/Typography', () => ({
  AnimatedText: require('react-native').Text,
  AnimateableText: require('react-native').Text,
}));
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: { View: require('react-native').View },
    Easing: { bezier: jest.fn(), linear: jest.fn() },
    runOnJS: (fn: unknown) => fn,
    withTiming: (value: unknown) => value,
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useDerivedValue: (derive: () => unknown) => ({
      get value() {
        return derive();
      },
    }),
    useAnimatedStyle: (derive: () => unknown) => derive(),
    useAnimatedProps: (derive: () => unknown) => derive(),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, prev: null) => void,
    ) => {
      ReactModule.useEffect(() => {
        react(prepare(), null);
      });
    },
  };
});

// Reanimated is a native boundary. This proves the rendered sizing contract;
// it does not simulate native worklet scheduling or font rasterization.
it.each([160, 190])(
  'fits Home ticker glyphs into %s after layout and preserves the original balance text',
  availableWidth => {
    const onLayout = jest.fn();
    const props = {
      value: { value: '₦1,593,285.32' },
      lineHeight: 42,
      maxLength: 24,
      animateWidth: false,
      fitWidth: true,
      fontSizeByLength: { maxFontSize: 38, minFontSize: 24, threshold: 9 },
      containerProps: { testID: 'ticker', onLayout },
    };
    const view = render(<AnimatedTickerText {...props} />);
    fireEvent(view.getByTestId('ticker'), 'layout', {
      nativeEvent: { layout: { width: availableWidth, height: 42 } },
    });
    // Refresh JS output after the native shared-value update in this boundary fake.
    view.rerender(<AnimatedTickerText {...props} value={{ ...props.value }} />);
    view.rerender(<AnimatedTickerText {...props} value={{ ...props.value }} />);
    expect(onLayout).toHaveBeenCalledTimes(1);
    const textStyles = view
      .getAllByText('1')
      .map(node => StyleSheet.flatten(node.props.style));
    expect(textStyles.every(style => style.fontSize < 30)).toBe(true);
    const columns = view.UNSAFE_getAllByType(View).filter(node => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.height === 42 && typeof style.width === 'number';
    });
    expect(columns).toHaveLength(props.value.value.length);
    const totalWidth = columns.reduce(
      (sum, node) => sum + StyleSheet.flatten(node.props.style).width,
      0,
    );
    expect(totalWidth).toBeLessThanOrEqual(availableWidth + 0.00001);
    expect(
      view
        .UNSAFE_getAllByType(Text)
        .some(node => node.props.animatedProps?.text === props.value.value),
    ).toBe(true);
  },
);

it('leaves non-opted-in ticker sizing and layout callback unchanged', () => {
  const onLayout = jest.fn();
  const view = render(
    <AnimatedTickerText
      value={{ value: '$12.34' }}
      lineHeight={42}
      containerProps={{ testID: 'ticker', onLayout }}
      fontSizeByLength={{ maxFontSize: 38, minFontSize: 24, threshold: 9 }}
    />,
  );
  expect(view.getByTestId('ticker').props.onLayout).toBe(onLayout);
  expect(
    StyleSheet.flatten(view.getAllByText('1')[0].props.style).fontSize,
  ).toBe(38);
});
