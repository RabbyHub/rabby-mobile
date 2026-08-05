import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
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

import { PerpsProOrderBookModeIcon } from './PerpsProOrderBookPrimitives';

describe('PerpsProOrderBookModeIcon', () => {
  it.each([
    ['asks', 'red-default'],
    ['bids', 'green-default'],
  ] as const)(
    'keeps the left guide fixed and merges the right side for %s',
    (mode, backgroundColor) => {
      render(<PerpsProOrderBookModeIcon mode={mode} />);

      const guide = screen.getByTestId('perps-pro-order-book-mode-guide');
      expect(guide.children).toHaveLength(3);
      guide.children.forEach(child => {
        expect(StyleSheet.flatten((child as any).props.style)).toMatchObject({
          backgroundColor: 'neutral-info',
        });
      });

      const sides = screen.getByTestId('perps-pro-order-book-mode-sides');
      expect(sides.children).toHaveLength(0);
      expect(StyleSheet.flatten(sides.props.style)).toMatchObject({
        backgroundColor,
        borderRadius: 1,
        height: 18,
        width: 8,
      });
    },
  );

  it('keeps the two colored right cells split in both mode', () => {
    render(<PerpsProOrderBookModeIcon mode="both" />);

    const sides = screen.getByTestId('perps-pro-order-book-mode-sides');
    expect(sides.children).toHaveLength(2);
    expect(StyleSheet.flatten(sides.props.style)).toMatchObject({ gap: 2 });
    expect(
      StyleSheet.flatten((sides.children[0] as any).props.style),
    ).toMatchObject({ backgroundColor: 'red-default' });
    expect(
      StyleSheet.flatten((sides.children[1] as any).props.style),
    ).toMatchObject({ backgroundColor: 'green-default' });
  });
});
