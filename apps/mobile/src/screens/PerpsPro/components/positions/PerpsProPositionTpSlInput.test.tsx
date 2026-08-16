import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockDecimalProps = jest.fn();

jest.mock('@/assets2024/icons/perps/PerpsProPrecisionCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetTextInput: require('react-native').TextInput,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('../trade/PerpsProDecimalTextInput', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    PerpsProDecimalTextInput: (props: object) => {
      mockDecimalProps(props);
      return ReactModule.createElement(TextInput, props);
    },
  };
});

import { PerpsProPositionTpSlBottomSheetTextInput } from './PerpsProPositionTpSlBottomSheetTextInput';
import { PerpsProPositionTpSlInput } from './PerpsProPositionTpSlInput';

describe('PerpsProPositionTpSlInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the filled Figma typography, spacing, thousands formatting, and downward caret', () => {
    render(
      <PerpsProPositionTpSlInput
        accessibilityLabel="ROI"
        disabled={false}
        label="ROI"
        maxDecimals={8}
        onChangeText={jest.fn()}
        onPressMode={jest.fn()}
        testID="field"
        unit="%"
        value="63870.7"
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('field-field').props.style),
    ).toMatchObject({
      gap: 4,
      height: 40,
      paddingHorizontal: 8,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('field-label').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
      top: 4,
    });
    expect(screen.getByText('63,870.7')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('field-formatted-value').props.style,
      ),
    ).toMatchObject({
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      top: 18,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('field-caret').props.style),
    ).toMatchObject({
      height: 6,
      width: 8,
    });
    expect(screen.getByTestId('field-caret-glyph').props).toMatchObject({
      height: 4.11638,
      width: 5.69228,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('field-caret-glyph').props.style),
    ).toMatchObject({ transform: [{ rotate: '180deg' }] });
    expect(mockDecimalProps.mock.lastCall?.[0].inputComponent).toBe(
      PerpsProPositionTpSlBottomSheetTextInput,
    );
  });

  it('uses the centered empty label and reveals raw editable input only while focused', () => {
    const { rerender } = render(
      <PerpsProPositionTpSlInput
        accessibilityLabel="ROI"
        disabled={false}
        label="ROI"
        maxDecimals={8}
        onChangeText={jest.fn()}
        testID="field"
        value=""
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('field-placeholder').props.style),
    ).toMatchObject({ fontSize: 14, lineHeight: 18, top: 11 });

    rerender(
      <PerpsProPositionTpSlInput
        accessibilityLabel="ROI"
        disabled={false}
        label="ROI"
        maxDecimals={8}
        onChangeText={jest.fn()}
        testID="field"
        value="1234.5"
      />,
    );
    expect(screen.getByText('1,234.5')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style)).toEqual(
      expect.objectContaining({ color: 'transparent' }),
    );

    fireEvent(screen.getByTestId('field'), 'focus');
    expect(screen.queryByTestId('field-formatted-value')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style)).toEqual(
      expect.objectContaining({ color: 'neutral-title-1' }),
    );
  });

  it('shows a fixed negative sign for Stop Loss ROI/PnL magnitudes', () => {
    render(
      <PerpsProPositionTpSlInput
        accessibilityLabel="ROI"
        disabled={false}
        label="ROI"
        maxDecimals={8}
        negative
        onChangeText={jest.fn()}
        testID="field"
        value="30"
      />,
    );

    expect(screen.getByText('−30')).toBeTruthy();
  });
});
