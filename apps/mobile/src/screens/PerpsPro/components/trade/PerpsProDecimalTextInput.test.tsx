import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { TextInput as RNTextInput } from 'react-native';

import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';

const mockSetNativeProps = jest.fn();

jest.mock('@/components/Typography', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    TextInput: ReactModule.forwardRef(
      (props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          setNativeProps: mockSetNativeProps,
        }));
        return ReactModule.createElement(TextInput, props);
      },
    ),
  };
});

const MockInputComponent = React.forwardRef<
  RNTextInput,
  React.ComponentProps<typeof RNTextInput>
>((props, ref) => (
  <RNTextInput
    {...props}
    accessibilityHint="test-bottom-sheet-input-host"
    ref={ref}
  />
));

describe('PerpsProDecimalTextInput', () => {
  beforeEach(() => {
    mockSetNativeProps.mockClear();
  });

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
    expect(mockSetNativeProps).toHaveBeenCalledWith({ text: '1.23' });
  });

  it('applies a caller normalization in the same native change event', () => {
    const onChangeText = jest.fn();
    render(
      <PerpsProDecimalTextInput
        maxDecimals={0}
        normalizeValue={value => (Number(value) > 40 ? '40' : value)}
        onChangeText={onChangeText}
        testID="decimal-input"
        value="20"
      />,
    );

    fireEvent.changeText(screen.getByTestId('decimal-input'), '401a');

    expect(onChangeText).toHaveBeenCalledWith('40');
    expect(mockSetNativeProps).toHaveBeenCalledWith({ text: '40' });
  });

  it('holds the initial cursor after the current value until editing starts', () => {
    const onChangeText = jest.fn();
    render(
      <PerpsProDecimalTextInput
        focusCursorAtEnd
        maxDecimals={0}
        onChangeText={onChangeText}
        testID="decimal-input"
        value="20"
      />,
    );

    fireEvent(screen.getByTestId('decimal-input'), 'focus', {
      nativeEvent: {},
    });

    expect(mockSetNativeProps).toHaveBeenCalledWith({
      selection: { end: 2, start: 2 },
    });
    expect(screen.getByTestId('decimal-input').props.selection).toEqual({
      end: 2,
      start: 2,
    });

    fireEvent(screen.getByTestId('decimal-input'), 'selectionChange', {
      nativeEvent: { selection: { end: 1, start: 1 } },
    });

    expect(screen.getByTestId('decimal-input').props.selection).toEqual({
      end: 2,
      start: 2,
    });
    expect(mockSetNativeProps).toHaveBeenLastCalledWith({
      selection: { end: 2, start: 2 },
    });

    fireEvent.changeText(screen.getByTestId('decimal-input'), '201');

    expect(onChangeText).toHaveBeenCalledWith('201');
    expect(screen.getByTestId('decimal-input').props.selection).toBeUndefined();
  });

  it('releases the forced end cursor when the input blurs', () => {
    render(
      <PerpsProDecimalTextInput
        focusCursorAtEnd
        maxDecimals={0}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value="20"
      />,
    );

    fireEvent(screen.getByTestId('decimal-input'), 'focus', {
      nativeEvent: {},
    });
    fireEvent(screen.getByTestId('decimal-input'), 'blur', {
      nativeEvent: {},
    });

    expect(screen.getByTestId('decimal-input').props.selection).toBeUndefined();
  });

  it('uses an injected input host only when explicitly requested', () => {
    render(
      <PerpsProDecimalTextInput
        inputComponent={MockInputComponent}
        maxDecimals={0}
        onChangeText={jest.fn()}
        testID="decimal-input"
        value="20"
      />,
    );

    expect(screen.getByTestId('decimal-input').props.accessibilityHint).toBe(
      'test-bottom-sheet-input-host',
    );
    expect(screen.getByTestId('decimal-input').props.allowFontScaling).toBe(
      false,
    );
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
