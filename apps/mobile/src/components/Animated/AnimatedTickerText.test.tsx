import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedTickerText from './AnimatedTickerText';

const mockNewSharedValue = jest.fn();

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
    useSharedValue: (value: unknown) => {
      const ref = ReactModule.useRef();
      if (!ref.current) {
        mockNewSharedValue(value);
        ref.current = { value };
      }
      return ref.current;
    },
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

it.each([
  ['longer', '$12.34', '₦1,593,285.32'],
  ['shorter', '₦1,593,285.32', '$98.76'],
])(
  'removes and restores animation columns with a %s inactive value and the measured width',
  (_direction, initialValue, inactiveValue) => {
    const availableWidth = 160;
    const lineHeight = 42;
    const onLayout = jest.fn();
    const props = {
      lineHeight,
      maxLength: 24,
      animateWidth: false,
      fitWidth: true,
      fontSizeByLength: { maxFontSize: 38, minFontSize: 24, threshold: 9 },
      containerProps: { testID: 'ticker', onLayout },
    };
    const renderTicker = (animate: boolean, value: string) => (
      <AnimatedTickerText {...props} animate={animate} value={{ value }} />
    );
    const view = render(renderTicker(true, initialValue));
    const ticker = view.getByTestId('ticker');
    const getColumns = () =>
      view.UNSAFE_getAllByType(View).filter(node => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.height === lineHeight && typeof style.width === 'number';
      });

    fireEvent(ticker, 'layout', {
      nativeEvent: { layout: { width: availableWidth, height: lineHeight } },
    });
    // Flush the boundary fake's shared-value updates; this is not a native-frame test.
    view.rerender(renderTicker(true, initialValue));
    view.rerender(renderTicker(true, initialValue));
    expect(getColumns()).toHaveLength(initialValue.length);
    expect(view.getAllByText('0')).toHaveLength(initialValue.length);
    const initialFontSize = StyleSheet.flatten(
      view.getAllByText('0')[0].props.style,
    ).fontSize;

    view.rerender(renderTicker(false, initialValue));
    expect(getColumns()).toHaveLength(0);
    expect(view.queryAllByText('0')).toHaveLength(0);
    expect(view.UNSAFE_getAllByType(Text)).toHaveLength(1);
    expect(
      StyleSheet.flatten(view.UNSAFE_getByType(Text).props.style),
    ).toMatchObject({ display: 'flex', fontSize: initialFontSize });

    view.rerender(renderTicker(false, inactiveValue));
    expect(getColumns()).toHaveLength(0);
    expect(view.UNSAFE_getAllByType(Text)).toHaveLength(1);
    expect(view.UNSAFE_getByType(Text).props.animatedProps.text).toBe(
      inactiveValue,
    );
    const inactiveStyle = StyleSheet.flatten(
      view.UNSAFE_getByType(Text).props.style,
    );
    expect(inactiveStyle.display).toBe('flex');
    if (_direction === 'longer') {
      expect(inactiveStyle.fontSize).toBeLessThan(30);
    } else {
      expect(inactiveStyle.fontSize).toBe(38);
    }

    view.rerender(renderTicker(true, inactiveValue));
    view.rerender(renderTicker(true, inactiveValue));
    view.rerender(renderTicker(true, inactiveValue));

    const columns = getColumns();
    // The ticker retains its maximum allocated slots; shorter values hide spare slots.
    const expectedColumnCount = Math.max(
      initialValue.length,
      inactiveValue.length,
    );
    expect(columns).toHaveLength(expectedColumnCount);
    expect(view.getAllByText('0')).toHaveLength(expectedColumnCount);
    expect(
      view
        .getAllByText('0')
        .every(
          node =>
            StyleSheet.flatten(node.props.style).fontSize ===
            inactiveStyle.fontSize,
        ),
    ).toBe(true);
    const columnStyles = columns.map(node =>
      StyleSheet.flatten(node.props.style),
    );
    expect(columnStyles.filter(style => style.width > 0)).toHaveLength(
      inactiveValue.length,
    );
    expect(
      columnStyles.reduce((total, style) => total + style.width, 0),
    ).toBeLessThanOrEqual(availableWidth + 0.00001);
    expect(
      columnStyles
        .slice(inactiveValue.length)
        .every(style => style.opacity === 0),
    ).toBe(true);

    const rollingStyles = view
      .UNSAFE_getAllByType(View)
      .map(node => StyleSheet.flatten(node.props.style))
      .filter(style => Array.isArray(style?.transform));
    expect(rollingStyles).toHaveLength(expectedColumnCount);
    rollingStyles.forEach((style, index) => {
      const char = inactiveValue.charAt(index);
      const isDigit = /^\d$/.test(char);
      expect(style.opacity).toBe(isDigit ? 1 : 0);
      if (isDigit) {
        expect(style.transform).toEqual([
          { translateY: -Number(char) * lineHeight },
        ]);
      }
    });
    expect(
      view
        .UNSAFE_getAllByType(Text)
        .some(node => node.props.animatedProps?.text === inactiveValue),
    ).toBe(true);
    expect(view.getByTestId('ticker')).toBe(ticker);
    expect(onLayout).toHaveBeenCalledTimes(1);
  },
);

it.each([undefined, false])(
  'preserves the legacy inactive text style when fitWidth=%s',
  fitWidth => {
    const onLayout = jest.fn();
    const value = '₦1,593,285.32';
    const view = render(
      <AnimatedTickerText
        value={{ value }}
        animate={false}
        fitWidth={fitWidth}
        lineHeight={42}
        style={{ fontSize: 36 }}
        fontSizeByLength={{ maxFontSize: 38, minFontSize: 24, threshold: 9 }}
        containerProps={{ testID: 'ticker', onLayout }}
      />,
    );
    const text = view.UNSAFE_getByType(Text);
    expect(StyleSheet.flatten(text.props.style)).toEqual({
      fontSize: 36,
      lineHeight: 42,
      height: 42,
    });
    expect(text.props.animatedProps.text).toBe(value);
    expect(view.getByTestId('ticker').props.onLayout).toBe(onLayout);
  },
);

it.each([
  ['$1,149.05', '₦1,593,285.32'],
  ['₦1,593,285.32', '$98.76'],
  ['****', '$1,149.05'],
  ['$1,149.05', '****'],
])(
  'preserves column geometry while paused and catches up from %s to %s',
  (initialValue, inactiveValue) => {
    const props = {
      lineHeight: 42,
      maxLength: 24,
      animateWidth: false,
      fitWidth: true,
      style: { fontFamily: 'SF Pro Rounded', fontWeight: '700' as const },
      fontSizeByLength: { maxFontSize: 38, minFontSize: 24, threshold: 9 },
      containerProps: { testID: 'ticker' },
    };
    const renderTicker = (active: boolean, value: string) => (
      <AnimatedTickerText {...props} active={active} value={{ value }} />
    );
    const view = render(renderTicker(true, initialValue));
    const ticker = view.getByTestId('ticker');
    const geometry = () =>
      view.UNSAFE_getAllByType(View).flatMap(node => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.height === 42 && typeof style.width === 'number'
          ? [
              {
                width: style.width,
                height: style.height,
                opacity: style.opacity,
              },
            ]
          : [];
      });
    const staticGlyphs = () =>
      view.UNSAFE_getAllByType(Text).filter(node => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.position === 'absolute';
      });

    fireEvent(ticker, 'layout', {
      nativeEvent: { layout: { width: 190, height: 42 } },
    });
    view.rerender(renderTicker(true, initialValue));
    view.rerender(renderTicker(true, initialValue));
    const initialGeometry = geometry();
    expect(view.getAllByText('0')).toHaveLength(initialValue.length);
    const initialFontSize = StyleSheet.flatten(
      view.getAllByText('0')[0].props.style,
    ).fontSize;

    view.rerender(renderTicker(false, initialValue));
    expect(geometry()).toEqual(initialGeometry);
    // No rolling digit trees remain. Static glyphs retain each slot's width,
    // instead of collapsing into a proportionally spaced whole-string Text.
    expect(view.queryAllByText('0')).toHaveLength(0);
    expect(staticGlyphs()).toHaveLength(initialValue.length);
    expect(
      staticGlyphs()
        .map(node => node.props.animatedProps.text)
        .join(''),
    ).toBe(initialValue);
    staticGlyphs().forEach(node => {
      expect(StyleSheet.flatten(node.props.style)).toMatchObject({
        ...props.style,
        fontSize: initialFontSize,
        lineHeight: 42,
        height: 42,
        textAlign: 'center',
      });
    });

    view.rerender(renderTicker(false, inactiveValue));
    view.rerender(renderTicker(false, inactiveValue));
    expect(view.queryAllByText('0')).toHaveLength(0);
    expect(
      staticGlyphs()
        .map(node => node.props.animatedProps.text)
        .join(''),
    ).toBe(inactiveValue);
    const pausedGeometry = geometry();
    expect(pausedGeometry.filter(column => column.width > 0)).toHaveLength(
      inactiveValue.length,
    );
    expect(
      pausedGeometry.reduce((sum, column) => sum + column.width, 0),
    ).toBeLessThanOrEqual(190.00001);

    mockNewSharedValue.mockClear();
    view.rerender(renderTicker(true, inactiveValue));
    // Check the actual useSharedValue initialization, before its later width
    // reaction can hide an unfitted first native frame after resuming.
    expect(
      mockNewSharedValue.mock.calls
        .map(([value]) => value)
        .filter(value => value > 0),
    ).toEqual(
      pausedGeometry
        .filter(column => column.width > 0)
        .map(column => column.width),
    );
    view.rerender(renderTicker(true, inactiveValue));
    expect(geometry()).toEqual(pausedGeometry);
    expect(view.getAllByText('0')).toHaveLength(
      Math.max(initialValue.length, inactiveValue.length),
    );
    const rollingStyles = view
      .UNSAFE_getAllByType(View)
      .map(node => StyleSheet.flatten(node.props.style))
      .filter(style => Array.isArray(style?.transform));
    rollingStyles.forEach((style, index) => {
      const char = inactiveValue.charAt(index);
      const isDigit = /^\d$/.test(char);
      expect(style.opacity).toBe(isDigit ? 1 : 0);
      if (isDigit) {
        expect(style.transform).toEqual([{ translateY: -Number(char) * 42 }]);
      }
    });
    expect(view.getByTestId('ticker')).toBe(ticker);
  },
);

it.each(['د.إ12.34', '$123456789'])(
  'keeps the whole-text fallback for %s while activity changes',
  value => {
    const props = {
      value: { value },
      maxLength: 8,
      lineHeight: 42,
      fontSizeByLength: { maxFontSize: 38, minFontSize: 24, threshold: 9 },
    };
    const view = render(<AnimatedTickerText {...props} active />);
    for (const active of [false, true]) {
      view.rerender(<AnimatedTickerText {...props} active={active} />);
      const fallback = view
        .UNSAFE_getAllByType(Text)
        .filter(node => node.props.animatedProps?.text === value);
      expect(fallback).toHaveLength(1);
      expect(StyleSheet.flatten(fallback[0].props.style).display).toBe('flex');
      const columnStyles = view
        .UNSAFE_getAllByType(View)
        .map(node => StyleSheet.flatten(node.props.style))
        .filter(style => typeof style?.width === 'number');
      expect(columnStyles.length).toBeGreaterThan(0);
      expect(
        columnStyles.every(style => style.width === 0 && style.opacity === 0),
      ).toBe(true);
    }
  },
);

it('retains explicitly non-animated text semantics when inactive', () => {
  const value = '$1,149.05';
  const view = render(
    <AnimatedTickerText
      value={{ value }}
      animate={false}
      active={false}
      lineHeight={42}
    />,
  );
  expect(view.UNSAFE_getAllByType(Text)).toHaveLength(1);
  expect(view.UNSAFE_getByType(Text).props.animatedProps.text).toBe(value);
  expect(view.queryAllByText('0')).toHaveLength(0);
});
