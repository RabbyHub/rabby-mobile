import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PerpsProOpenOrderEditInput } from './PerpsProOpenOrderEditInput';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetTextInput: require('react-native').TextInput,
}));

jest.mock('../trade/PerpsProDecimalTextInput', () => ({
  PerpsProDecimalTextInput: () => null,
}));

describe('PerpsProOpenOrderEditInput', () => {
  it('keeps the emphasized nested label on the rounded medium face', () => {
    render(
      <PerpsProOpenOrderEditInput
        accessibilityLabel="Limit price"
        currentValue="$100"
        label="Limit Price"
        maxDecimals={2}
        onChangeText={jest.fn()}
        value="100"
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByText('Limit Price').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
    });
  });
});
