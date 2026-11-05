import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
import { AutoShrinkAmountTextInput } from './AutoShrinkAmountTextInput';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

// Component contract with the real fitting hook and layout callbacks. Jest
// cannot prove UIKit glyph positioning; the iOS clipping case needs a device.
const shortAmount = '1.25';
const longAmount = '0.00000004713258051';
const amountStyle = {
  fontFamily: 'SF Pro Rounded',
  fontWeight: '700' as const,
  fontSize: 28,
  height: 36,
};

function inputStyle() {
  return StyleSheet.flatten(screen.getByTestId('amount').props.style);
}

function measureAmount(width: number) {
  fireEvent(screen.UNSAFE_getByType(Text), 'textLayout', {
    nativeEvent: { lines: [{ width }] },
  });
}

function layoutInput(width = 160) {
  const event = {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 36 } },
  };
  fireEvent(screen.getByTestId('amount'), 'layout', event);
  return event;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('single-line amount fitting', () => {
  it.each([true, false])(
    'keeps the iOS input height without a paragraph line height (explicit=%s)',
    explicitLineHeight => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      const onLayout = jest.fn();
      const style = [
        amountStyle,
        explicitLineHeight ? { lineHeight: 36 } : undefined,
      ];
      const renderInput = (value: string) => (
        <AutoShrinkAmountTextInput
          testID="amount"
          value={value}
          style={style}
          onLayout={onLayout}
          multiline={false}
          scrollEnabled
        />
      );
      const view = render(renderInput(shortAmount));

      const layoutEvent = layoutInput();
      measureAmount(100);
      expect(onLayout).toHaveBeenCalledWith(layoutEvent);
      expect(inputStyle()).toMatchObject({ ...amountStyle, fontSize: 28 });
      expect(inputStyle().lineHeight).toBeUndefined();
      expect(screen.getByTestId('amount').props.scrollEnabled).toBe(false);

      view.rerender(renderInput(longAmount));
      expect(screen.UNSAFE_getByType(Text).props.children).toBe(longAmount);
      measureAmount(400);
      expect(inputStyle()).toMatchObject({ ...amountStyle, fontSize: 18 });
      expect(inputStyle().lineHeight).toBeUndefined();

      view.rerender(renderInput(shortAmount));
      measureAmount(100);
      expect(inputStyle()).toMatchObject({ ...amountStyle, fontSize: 28 });
      expect(inputStyle().lineHeight).toBeUndefined();
    },
  );

  it.each([
    ['explicit', { height: 44, lineHeight: 36 }],
    ['height fallback', { height: 36 }],
  ] as const)(
    'preserves the Android %s line height when shrinking',
    (_, size) => {
      jest.replaceProperty(Platform, 'OS', 'android');
      render(
        <AutoShrinkAmountTextInput
          testID="amount"
          value={longAmount}
          style={[amountStyle, size]}
        />,
      );

      expect(inputStyle().lineHeight).toBe(36);
      layoutInput();
      measureAmount(400);
      expect(inputStyle()).toMatchObject({
        fontSize: 18,
        height: size.height,
        lineHeight: 36,
        paddingVertical: 0,
        textAlignVertical: 'center',
      });
    },
  );
});

describe.each(['ios', 'android'] as const)('%s input forwarding', os => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it('preserves the controlled value, change handler and native ref', () => {
    const ref = React.createRef<TextInput>();
    const onChangeText = jest.fn();
    const view = render(
      <AutoShrinkAmountTextInput
        ref={ref}
        testID="amount"
        value={shortAmount}
        onChangeText={onChangeText}
        style={amountStyle}
      />,
    );

    expect(ref.current).not.toBeNull();
    expect(ref.current).toBe(screen.UNSAFE_getByType(TextInput).instance);
    expect(screen.getByTestId('amount').props.value).toBe(shortAmount);
    fireEvent.changeText(screen.getByTestId('amount'), longAmount);
    expect(onChangeText).toHaveBeenCalledWith(longAmount);
    expect(screen.getByTestId('amount').props.value).toBe(shortAmount);

    view.rerender(
      <AutoShrinkAmountTextInput
        ref={ref}
        testID="amount"
        value={longAmount}
        onChangeText={onChangeText}
        style={amountStyle}
      />,
    );
    expect(screen.getByTestId('amount').props.value).toBe(longAmount);
    expect(ref.current).toBe(screen.UNSAFE_getByType(TextInput).instance);
  });

  it('leaves multiline sizing and scrolling unchanged', () => {
    const style = {
      ...amountStyle,
      height: 80,
      lineHeight: 40,
      paddingVertical: 5,
      includeFontPadding: true,
      textAlignVertical: 'top' as const,
      overflow: 'visible' as const,
    };
    render(
      <AutoShrinkAmountTextInput
        testID="amount"
        value={longAmount}
        style={style}
        multiline
        scrollEnabled
      />,
    );

    layoutInput();
    measureAmount(400);
    expect(inputStyle()).toMatchObject({ ...style, fontSize: 18 });
    expect(screen.getByTestId('amount').props.multiline).toBe(true);
    expect(screen.getByTestId('amount').props.scrollEnabled).toBe(true);
  });
});
