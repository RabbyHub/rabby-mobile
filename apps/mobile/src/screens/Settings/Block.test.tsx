import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { Block } from './Block';

// Component contract for the optional label suffix. Theme, the touchable
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
  it('renders the label alone on the fixed single-line row', () => {
    render(<Block.Item label="Currency" rightNode={rightNode} />);

    const label = screen.getByText('Currency');
    expect(label.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBeUndefined();
    expect(getRowStyle()).toMatchObject({ height: 52, alignItems: 'center' });
  });

  it('keeps a label suffix on the row and lets a long label give way to it', () => {
    render(
      <Block.Item
        label="Help improve Rabby"
        labelSuffix={<View testID="label-info-icon" />}
        rightNode={rightNode}
      />,
    );

    const label = screen.getByText('Help improve Rabby');
    // Still one line: the label shrinks and truncates instead of pushing the
    // suffix out of the row.
    expect(label.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      flexShrink: 1,
    });
    expect(screen.getByTestId('label-info-icon')).toBeTruthy();
    expect(getRowStyle()).toMatchObject({ height: 52, alignItems: 'center' });
    expect(screen.getByTestId('setting-row-switch')).toBeTruthy();
  });
});
