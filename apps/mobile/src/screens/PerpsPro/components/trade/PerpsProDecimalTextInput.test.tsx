import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';

jest.mock('@/components/Typography', () => ({
  TextInput: require('react-native').TextInput,
}));

describe('PerpsProDecimalTextInput', () => {
  it('anchors only an empty value at position zero', () => {
    const { rerender } = render(
      <PerpsProDecimalTextInput
        maxDecimals={2}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value=""
      />,
    );

    expect(screen.getByTestId('decimal-input').props.selection).toEqual({
      end: 0,
      start: 0,
    });

    rerender(
      <PerpsProDecimalTextInput
        maxDecimals={2}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value="12.34"
      />,
    );

    expect(screen.getByTestId('decimal-input').props.selection).toBeUndefined();
  });

  it('normalizes unsupported characters before publishing the value', () => {
    const onChangeText = jest.fn();
    render(
      <PerpsProDecimalTextInput
        maxDecimals={2}
        onChangeText={onChangeText}
        testID="decimal-input"
        value=""
      />,
    );

    fireEvent.changeText(screen.getByTestId('decimal-input'), '01a,23.4');

    expect(onChangeText).toHaveBeenCalledWith('1.23');
    expect(screen.getByTestId('decimal-input').props.value).toBe('1.23');
  });

  it('reconciles an external reset before the committed layout is painted', () => {
    const { rerender } = render(
      <PerpsProDecimalTextInput
        maxDecimals={2}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value="30%"
      />,
    );

    rerender(
      <PerpsProDecimalTextInput
        maxDecimals={2}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value=""
      />,
    );

    expect(screen.getByTestId('decimal-input').props.value).toBe('');
  });

  it('locks insertion at the fractional precision boundary', () => {
    render(
      <PerpsProDecimalTextInput
        maxDecimals={2}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value="1.23"
      />,
    );
    const input = screen.getByTestId('decimal-input');

    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { end: 4, start: 4 } },
    });

    expect(screen.getByTestId('decimal-input').props.maxLength).toBe(4);
  });
});
