import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { Block } from './Block';

// Component contract for the optional row description. Theme, the touchable
// wrapper and icons are replaced; the real row layout rules stay under test.
jest.mock('@/assets/icons/settings/icon-arrow-right.svg', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/Touchable/TouchableView', () => ({
  __esModule: true,
  default: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'setting-row',
    }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/core/utils/fonts', () => ({
  RoundedFontStyles: { regular: {}, bold: {} },
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: (input?: { getStyle: (ctx: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      isLight: true,
      styles: input?.getStyle({ colors2024 }) ?? {},
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/utils/makeTestIDProps', () => ({
  makeTestIDProps: () => ({}),
}));

const rightNode = <View testID="setting-row-switch" />;

function getRowStyle() {
  return StyleSheet.flatten(screen.getByTestId('setting-row').props.style);
}

describe('Settings Block.Item', () => {
  it('keeps the fixed single-line row when there is no description', () => {
    render(<Block.Item label="Currency" rightNode={rightNode} />);

    expect(screen.getByText('Currency').props.numberOfLines).toBe(1);
    expect(getRowStyle()).toMatchObject({ height: 52, alignItems: 'center' });
  });

  it('grows with its content and top-aligns when a description is set', () => {
    render(
      <Block.Item
        label="Help improve Rabby"
        description="Share anonymous usage data."
        rightNode={rightNode}
      />,
    );

    // The description reads as secondary text, not as a second label.
    expect(
      StyleSheet.flatten(
        screen.getByText('Share anonymous usage data.').props.style,
      ),
    ).toMatchObject({ color: 'neutral-secondary', fontSize: 12 });
    expect(screen.getByText('Help improve Rabby').props.numberOfLines).toBe(2);
    expect(getRowStyle()).toMatchObject({
      height: 'auto',
      minHeight: 52,
      alignItems: 'flex-start',
    });
    expect(screen.getByTestId('setting-row-switch')).toBeTruthy();
  });
});
