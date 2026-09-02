import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { FontNames } from '@/core/utils/fonts';

const mockCancelAnimation = jest.fn();
const mockWithTiming = jest.fn((value: number) => value);

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => 'desktop-ease-out' },
    ReduceMotion: { System: 'system' },
    cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    withTiming: (...args: [number, object]) => mockWithTiming(...args),
  };
});

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
  PerpsProOrderBookDepth,
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
  beforeEach(() => {
    mockCancelAnimation.mockClear();
    mockWithTiming.mockClear();
  });

  it('renders a neutral placeholder and emits an invalid price attempt', () => {
    const onSelectPrice = jest.fn();
    render(
      <PerpsProOrderBookRow
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
    expect(onSelectPrice).toHaveBeenCalledTimes(1);
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
        priceDecimals={2}
        side="bid"
      />,
    );
    expect(screen.getByText('1.00K')).toBeTruthy();
  });

  it('animates only a retained price in the same presentation context', () => {
    const level = {
      price: '100',
      priceNumber: 100,
      size: 2,
      total: 2,
      totalUsd: 200,
      usdSize: 200,
    };
    const view = render(
      <PerpsProOrderBookDepth
        animationIdentity="BTC:5:null|both|6|content"
        level={level}
        maxTotal={4}
        rowIndex={3}
        side="bid"
      />,
    );

    expect(mockWithTiming).not.toHaveBeenCalled();
    mockCancelAnimation.mockClear();

    view.rerender(
      <PerpsProOrderBookDepth
        animationIdentity="BTC:5:null|both|6|content"
        level={{ ...level, size: 3, total: 3, totalUsd: 300, usdSize: 300 }}
        maxTotal={4}
        rowIndex={2}
        side="bid"
      />,
    );

    expect(mockWithTiming).toHaveBeenCalledWith(75, {
      duration: 200,
      easing: 'desktop-ease-out',
      reduceMotion: 'system',
    });
    expect(mockCancelAnimation).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProOrderBookDepth
        animationIdentity="BTC:5:null|both|6|content"
        level={{
          ...level,
          price: '101',
          priceNumber: 101,
          total: 1,
          totalUsd: 101,
          usdSize: 101,
        }}
        maxTotal={4}
        rowIndex={2}
        side="bid"
      />,
    );

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProOrderBookDepth
        animationIdentity="ETH:5:null|both|6|content"
        level={{
          ...level,
          price: '101',
          priceNumber: 101,
          total: 2,
          totalUsd: 202,
          usdSize: 202,
        }}
        maxTotal={4}
        rowIndex={1}
        side="bid"
      />,
    );

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockCancelAnimation).toHaveBeenCalledTimes(2);

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-book-depth').props.style,
      ),
    ).toMatchObject({ height: 20, top: 20 });
    view.unmount();

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockCancelAnimation).toHaveBeenCalledTimes(3);
  });
});
