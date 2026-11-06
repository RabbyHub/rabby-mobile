import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { RoundedFontStyles } from '@/core/utils/fonts';

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
    const onToggleKline = jest.fn();
    const onPress = jest.fn();
    render(
      <PerpsProMarketBar
        klineOpen
        market={market}
        onPress={onPress}
        onToggleKline={onToggleKline}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-selector-trigger'));
    fireEvent.press(screen.getByTestId('perps-pro-kline-trigger'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onToggleKline).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('perps-pro-kline-trigger').props.accessibilityLabel,
    ).toBe('page.perps.pro.chart.open');
    expect(
      screen.getByTestId('perps-pro-kline-trigger').props.accessibilityState,
    ).toMatchObject({ expanded: true });
    expect(
      React.Children.count(
        screen.getByTestId('perps-pro-market-actions').props.children,
      ),
    ).toBe(1);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-bar').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      height: 40,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-pro-market-bar').props.style)
        .borderTopWidth,
    ).toBeUndefined();
    expect(screen.getByTestId('market-caret').props).toMatchObject({
      color: 'neutral-title-1',
      height: 18,
      width: 18,
    });
  });

  it('disables the K-line action when no market is resolved', () => {
    const onToggleKline = jest.fn();
    render(
      <PerpsProMarketBar
        klineOpen={false}
        market={null}
        onPress={jest.fn()}
        onToggleKline={onToggleKline}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-kline-trigger'));
    expect(onToggleKline).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-kline-trigger').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('renders the market source with the shared metadata tag contract', () => {
    render(
      <PerpsProMarketBar
        market={{ ...market, sourceTag: 'xyz' }}
        klineOpen={false}
        onPress={jest.fn()}
        onToggleKline={jest.fn()}
      />,
    );

    const sourceStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-source-tag').props.style,
    );
    expect(sourceStyle).toEqual({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 4,
      maxWidth: 52,
      overflow: 'hidden',
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(StyleSheet.flatten(screen.getByText('xyz').props.style)).toEqual({
      color: 'neutral-foot',
      ...RoundedFontStyles.medium,
      fontSize: 12,
      lineHeight: 16,
    });
    expect(sourceStyle.borderColor).toBeUndefined();
    expect(sourceStyle.borderWidth).toBeUndefined();
    expect(sourceStyle.fontVariant).toBeUndefined();
  });
});
