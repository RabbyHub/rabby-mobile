import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  AutoShrinkAmountText,
  AutoShrinkAmountTextInput,
} from './AutoShrinkAmountTextInput';

jest.mock('@/components/Typography', () => {
  const ReactNative = jest.requireActual('react-native');

  return {
    Text: ReactNative.Text,
    TextInput: ReactNative.TextInput,
  };
});

describe('AutoShrinkAmountTextInput', () => {
  it('shrinks the input font size to the largest fitting step', () => {
    render(
      <AutoShrinkAmountTextInput
        testID="amount-input"
        value="123456"
        style={{ fontSize: 28, height: 40 }}
      />,
    );
    const input = screen.getByTestId('amount-input');
    const measureText = screen.getByText('123456');

    expect(StyleSheet.flatten(input.props.style).fontSize).toBe(28);

    fireEvent(input, 'layout', {
      nativeEvent: { layout: { width: 120 } },
    });
    fireEvent(measureText, 'textLayout', {
      nativeEvent: { lines: [{ width: 150 }] },
    });

    expect(StyleSheet.flatten(input.props.style).fontSize).toBe(22);
    expect(input.props.scrollEnabled).toBe(false);
  });

  it('keeps multiline input scroll behavior caller-controlled', () => {
    render(
      <AutoShrinkAmountTextInput
        testID="amount-input"
        multiline
        scrollEnabled
        value="123456"
      />,
    );

    expect(screen.getByTestId('amount-input').props.scrollEnabled).toBe(true);
  });

  it('shrinks display text using the same measuring path', () => {
    render(
      <AutoShrinkAmountText
        testID="amount-text"
        style={{ fontSize: 28 }}
        maxFontSize={28}
        minFontSize={18}
        fontSizeStep={2}>
        123456
      </AutoShrinkAmountText>,
    );
    const visibleText = screen.getByTestId('amount-text');
    const [, measureText] = screen.getAllByText('123456');

    fireEvent(visibleText, 'layout', {
      nativeEvent: { layout: { width: 120 } },
    });
    fireEvent(measureText, 'textLayout', {
      nativeEvent: { lines: [{ width: 150 }] },
    });

    expect(StyleSheet.flatten(visibleText.props.style).fontSize).toBe(22);
  });
});
