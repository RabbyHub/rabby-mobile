import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { perpsStore, type MarketData } from '@/hooks/perps/usePerpsStore';
import type { PerpsProMarketDescriptor } from '../../model/market';
import { PerpsProMarketBar } from './PerpsProMarketBar';

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    marketData: [],
    marketDataMap: {},
  })),
}));

// Keep callback and disabled semantics real; native hit testing is device-only.
jest.mock('react-native-gesture-handler', () => ({
  Pressable: require('react-native').Pressable,
}));

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
  canonicalCoin: 'BTC',
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  fullName: null,
  marketKey: 'hyperliquid::BTC',
  quoteAsset: 'USDC',
  sourceTag: null,
} satisfies PerpsProMarketDescriptor;

const marketData = {
  name: 'BTC',
  markPx: '102.3',
  prevDayPx: '100',
} as MarketData;

describe('PerpsProMarketBar', () => {
  beforeEach(() => {
    perpsStore.setState({
      marketData: [marketData],
      marketDataMap: { BTC: marketData },
    });
  });

  it('updates its percentage from the live store while retaining the descriptor and parent', () => {
    const parentRender = jest.fn();
    function Parent() {
      parentRender();
      return (
        <PerpsProMarketBar
          market={market}
          onOpenKline={jest.fn()}
          onPress={jest.fn()}
        />
      );
    }
    render(<Parent />);
    expect(screen.getByText('+2.30%')).toBeOnTheScreen();
    const renders = parentRender.mock.calls.length;
    act(() =>
      perpsStore.setState({
        marketDataMap: { BTC: { ...marketData, markPx: '95' } },
      }),
    );
    expect(screen.getByText('-5.00%')).toBeOnTheScreen();
    act(() =>
      perpsStore.setState({
        marketDataMap: {
          BTC: { ...marketData, markPx: '95', prevDayPx: '50' },
        },
      }),
    );
    expect(screen.getByText('+90.00%')).toBeOnTheScreen();
    expect(parentRender).toHaveBeenCalledTimes(renders);
  });

  it('uses the matching array fallback and clears unavailable or invalid price values', () => {
    render(
      <PerpsProMarketBar
        market={market}
        onOpenKline={jest.fn()}
        onPress={jest.fn()}
      />,
    );
    act(() =>
      perpsStore.setState({
        marketDataMap: {},
        marketData: [{ ...marketData, markPx: '110' }],
      }),
    );
    expect(screen.getByText('+10.00%')).toBeOnTheScreen();
    act(() => perpsStore.setState({ marketData: [] }));
    expect(screen.getByText('-')).toBeOnTheScreen();
    act(() =>
      perpsStore.setState({
        marketDataMap: { BTC: { ...marketData, prevDayPx: '0' } },
      }),
    );
    expect(screen.getByText('-')).toBeOnTheScreen();
  });

  it('switches the live percentage to the next canonical market without keeping the old value', () => {
    perpsStore.setState({
      marketDataMap: {
        BTC: marketData,
        ETH: { ...marketData, name: 'ETH', markPx: '150' },
      },
    });
    const props = { onOpenKline: jest.fn(), onPress: jest.fn() };
    const view = render(<PerpsProMarketBar {...props} market={market} />);
    view.rerender(
      <PerpsProMarketBar
        {...props}
        market={{
          ...market,
          canonicalCoin: 'ETH',
          displayPair: 'ETHUSDC',
          marketKey: 'hyperliquid::ETH',
        }}
      />,
    );
    expect(screen.getByText('+50.00%')).toBeOnTheScreen();
    expect(screen.getByText('ETHUSDC')).toBeOnTheScreen();
  });

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

  it('disables the market and K-line actions when no market is resolved', () => {
    const onOpenKline = jest.fn();
    const onPress = jest.fn();
    render(
      <PerpsProMarketBar
        market={null}
        onOpenKline={onOpenKline}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-selector-trigger'));
    fireEvent.press(screen.getByTestId('perps-pro-kline-trigger'));
    expect(onPress).not.toHaveBeenCalled();
    expect(onOpenKline).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-kline-trigger').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('renders the market source with the shared metadata tag contract', () => {
    render(
      <PerpsProMarketBar
        market={{ ...market, sourceTag: 'xyz' }}
        onOpenKline={jest.fn()}
        onPress={jest.fn()}
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
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(sourceStyle.borderColor).toBeUndefined();
    expect(sourceStyle.borderWidth).toBeUndefined();
    expect(sourceStyle.fontVariant).toBeUndefined();
  });
});
