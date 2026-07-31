import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { PerpsProMarket } from '../../model/market';
import { PerpsProMarketBar } from './PerpsProMarketBar';

jest.mock('@/assets2024/icons/perps/PerpsProCandlestick.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'candlestick-icon',
    });
});

jest.mock('@/assets2024/icons/perps/PerpsProMarketCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, testID: 'market-caret' });
});

jest.mock('@/assets2024/icons/perps/PerpsProMore.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, testID: 'more-icon' });
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return {
      colors2024,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const market = {
  change24h: 0.023,
  displayPair: 'BTCUSDC',
  sourceTag: null,
} as unknown as PerpsProMarket;

describe('PerpsProMarketBar', () => {
  it('exposes independent market and K-line actions', () => {
    const onOpenKline = jest.fn();
    const onPress = jest.fn();
    render(
      <PerpsProMarketBar
        market={market}
        onOpenKline={onOpenKline}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-selector-trigger'));
    fireEvent.press(screen.getByTestId('perps-pro-kline-trigger'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onOpenKline).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('perps-pro-kline-trigger').props.accessibilityLabel,
    ).toBe('page.perps.pro.chart.open');
  });

  it('disables the K-line action when no market is resolved', () => {
    const onOpenKline = jest.fn();
    render(
      <PerpsProMarketBar
        market={null}
        onOpenKline={onOpenKline}
        onPress={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-kline-trigger'));
    expect(onOpenKline).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-kline-trigger').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
