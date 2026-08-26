import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { FontNames } from '@/core/utils/fonts';

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

import {
  PerpsProOrderBookModeIcon,
  PerpsProOrderBookRow,
} from './PerpsProOrderBookPrimitives';

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

describe('PerpsProOrderBookRow', () => {
  it('renders a neutral placeholder and emits an invalid price attempt', () => {
    const onSelectPrice = jest.fn();
    render(
      <PerpsProOrderBookRow
        maxTotal={0}
        onSelectPrice={onSelectPrice}
        priceDecimals={2}
        side="ask"
      />,
    );

    const placeholders = screen.getAllByText('--');
    expect(placeholders).toHaveLength(2);
    placeholders.forEach(placeholder => {
      expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
        color: 'neutral-secondary',
      });
    });
    fireEvent.press(screen.getByTestId('perps-pro-order-book-row'));
    expect(onSelectPrice).toHaveBeenCalledWith(null);
  });

  it('keeps the Figma row inset and shared platform font', () => {
    render(
      <PerpsProOrderBookRow
        level={{
          price: '100',
          priceNumber: 100,
          size: 2,
          total: 2,
          totalUsd: 200,
          usdSize: 200,
        }}
        maxTotal={2}
        priceDecimals={2}
        side="bid"
      />,
    );

    const price = screen.getByText('100.00');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-book-row').props.style,
      ),
    ).toMatchObject({ gap: 4, padding: 2 });
    expect(StyleSheet.flatten(price.props.style)).toMatchObject({
      fontFamily: FontNames.sf_pro,
    });
    expect(
      StyleSheet.flatten(screen.getByText('200').props.style),
    ).toMatchObject({
      fontFamily: FontNames.sf_pro,
    });
  });

  it('uses market size precision below 1K and fixed K/M/B precision', () => {
    const view = render(
      <PerpsProOrderBookRow
        amountDecimals={1}
        amountUnit="base"
        level={{
          price: '100',
          priceNumber: 100,
          size: 20,
          total: 20,
          totalUsd: 2000,
          usdSize: 2000,
        }}
        maxTotal={20}
        priceDecimals={2}
        side="bid"
      />,
    );

    expect(screen.getByText('20')).toBeTruthy();
    view.rerender(
      <PerpsProOrderBookRow
        amountDecimals={1}
        amountUnit="base"
        level={{
          price: '100',
          priceNumber: 100,
          size: 20.5,
          total: 20.5,
          totalUsd: 2050,
          usdSize: 2050,
        }}
        maxTotal={20.5}
        priceDecimals={2}
        side="bid"
      />,
    );
    expect(screen.getByText('20.5')).toBeTruthy();

    view.rerender(
      <PerpsProOrderBookRow
        amountDecimals={1}
        amountUnit="base"
        level={{
          price: '100',
          priceNumber: 100,
          size: 1000,
          total: 1000,
          totalUsd: 100000,
          usdSize: 100000,
        }}
        maxTotal={1000}
        priceDecimals={2}
        side="bid"
      />,
    );
    expect(screen.getByText('1.00K')).toBeTruthy();
  });
});
