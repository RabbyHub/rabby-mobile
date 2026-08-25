import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/perps/PerpsProFavoriteStar.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'favorite-star',
    });
});

jest.mock('@/assets/icons/dapp/icon-star.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'favorite-star-empty',
    });
});

jest.mock('./PerpsProMarketLogo', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketLogo: ({
      logoUrl,
      marketKey,
      ...props
    }: {
      logoUrl: string;
      marketKey: string;
      [key: string]: unknown;
    }) =>
      ReactModule.createElement(View, {
        ...props,
        accessibilityLabel: `${marketKey}:${logoUrl}`,
        testID: 'market-logo',
      }),
  };
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
    return { colors2024, isLight: true, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { pair?: string }) =>
      `${key}:${options?.pair ?? ''}`,
  }),
}));

const { buildPerpsProMarketRowModel } =
  require('../../model/marketSelectorProjection') as typeof import('../../model/marketSelectorProjection');
const {
  PerpsProMarketRow,
}: typeof import('./PerpsProMarketRow') = require('./PerpsProMarketRow');
type MarketData = import('@/hooks/perps/usePerpsStore').MarketData;

const createMarketData = (
  name: string,
  overrides: Partial<MarketData> = {},
): MarketData => ({
  brief: `${name} full name`,
  dayBaseVlm: '1',
  dayNtlVlm: '1200000',
  dexId: '',
  displayName: name,
  funding: '0.0001',
  index: 0,
  logoUrl: `https://example.test/${name}.png`,
  markPx: '120',
  maxLeverage: 20,
  maxUsdValueSize: '1000000',
  midPx: '120',
  minLeverage: 1,
  name,
  openInterest: '1',
  oraclePx: '120',
  premium: '0',
  prevDayPx: '100',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 2,
  ...overrides,
});

describe('PerpsProMarketRow', () => {
  it('matches the approved 56px row geometry and typography', () => {
    const model = buildPerpsProMarketRowModel(
      createMarketData('xyz:ALPHA', {
        brief: 'Alpha',
        dexId: 'xyz',
        displayName: 'ALPHA',
      }),
    );
    render(
      <PerpsProMarketRow
        favorite={false}
        model={model}
        onSelect={jest.fn()}
        onToggleFavorite={jest.fn()}
        selected={false}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByLabelText('page.perps.pro.marketSelector.select:ALPHAUSDC')
          .props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        alignItems: 'flex-start',
        height: 56,
        paddingHorizontal: 15,
        paddingVertical: 8,
      }),
    );
    expect(
      StyleSheet.flatten(
        screen.getByLabelText(
          'page.perps.pro.marketSelector.addFavorite:ALPHAUSDC',
        ).props.style,
      ),
    ).toEqual(
      expect.objectContaining({ height: 24, marginRight: 6, width: 16 }),
    );
    expect(screen.getByTestId('favorite-star-empty').props).toEqual(
      expect.objectContaining({ height: 16, width: 16 }),
    );
    expect(screen.getByTestId('market-logo').props).toEqual(
      expect.objectContaining({ size: 24 }),
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('market-logo').props.style),
    ).toEqual(
      expect.objectContaining({ borderRadius: 12, height: 24, width: 24 }),
    );
    expect(screen.getByText('ALPHAUSDC').props.style).toEqual(
      expect.objectContaining({
        fontFamily: 'SF Pro',
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 20,
      }),
    );
    expect(screen.getByText('120').props.style).toEqual(
      expect.objectContaining({
        fontFamily: 'SF Pro',
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 20,
      }),
    );
    expect(screen.getByText('xyz').props.style).toEqual(
      expect.objectContaining({
        borderRadius: 2,
        borderWidth: 0.5,
        fontSize: 10,
        fontWeight: '500',
        height: 14,
        lineHeight: 12,
        paddingHorizontal: 4,
      }),
    );
    expect(screen.getByText('Alpha').props.style).toEqual(
      expect.objectContaining({
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      }),
    );
    expect(screen.getByText('1.20M').props.style).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      }),
    );
    expect(screen.getByText('+20.00%').props.style).toEqual(
      expect.objectContaining({
        flexShrink: 0,
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        marginLeft: 20,
      }),
    );
  });

  it('keeps volume visible without a backend full name', () => {
    const model = buildPerpsProMarketRowModel(
      createMarketData('BTC', { brief: '   ' }),
    );

    render(
      <PerpsProMarketRow
        favorite={false}
        model={model}
        onSelect={jest.fn()}
        onToggleFavorite={jest.fn()}
        selected={false}
      />,
    );

    expect(model.fullName).toBeNull();
    expect(screen.queryByText('BTC full name')).toBeNull();
    expect(screen.getByText('1.20M')).toBeTruthy();
  });

  it('updates every market-bound field and handler when business identity changes', () => {
    const first = buildPerpsProMarketRowModel(createMarketData('ALPHA'));
    const second = buildPerpsProMarketRowModel(
      createMarketData('BETA', {
        dayNtlVlm: '2500000',
        markPx: '80',
        prevDayPx: '100',
      }),
    );
    const onSelect = jest.fn();
    const onPrefetch = jest.fn();
    const onToggleFavorite = jest.fn();
    const { rerender } = render(
      <PerpsProMarketRow
        favorite={false}
        model={first}
        onPrefetch={onPrefetch}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        selected={false}
      />,
    );

    expect(screen.getByText('ALPHAUSDC')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText('+20.00%')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'hyperliquid::ALPHA:https://example.test/ALPHA.png',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('favorite-star-empty')).toBeTruthy();

    rerender(
      <PerpsProMarketRow
        favorite
        model={second}
        onPrefetch={onPrefetch}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        selected
      />,
    );

    expect(screen.queryByText('ALPHAUSDC')).toBeNull();
    expect(screen.getByText('BETAUSDC')).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
    expect(screen.getByText('-20.00%')).toBeTruthy();
    expect(
      screen.getByLabelText('hyperliquid::BETA:https://example.test/BETA.png'),
    ).toBeTruthy();
    expect(screen.getByTestId('favorite-star').props).toMatchObject({
      color: 'orange-default',
      height: 13.5445,
      width: 13.6231,
    });
    expect(
      screen.getByLabelText('page.perps.pro.marketSelector.select:BETAUSDC')
        .props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent(
      screen.getByLabelText('page.perps.pro.marketSelector.select:BETAUSDC'),
      'pressIn',
    );
    expect(onPrefetch).toHaveBeenCalledTimes(1);
    fireEvent.press(
      screen.getByLabelText('page.perps.pro.marketSelector.select:BETAUSDC'),
    );
    expect(onSelect).toHaveBeenCalledWith('hyperliquid::BETA');

    const stopPropagation = jest.fn();
    fireEvent.press(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.removeFavorite:BETAUSDC',
      ),
      { stopPropagation },
    );
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledWith('hyperliquid::BETA');
  });

  it('cancels a touch when its physical slot changes business identity', () => {
    const first = buildPerpsProMarketRowModel(createMarketData('ALPHA'));
    const second = buildPerpsProMarketRowModel(createMarketData('BETA'));
    const onSelect = jest.fn();
    const onToggleFavorite = jest.fn();
    const { rerender } = render(
      <PerpsProMarketRow
        favorite={false}
        model={first}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        selected={false}
      />,
    );

    fireEvent(
      screen.getByLabelText('page.perps.pro.marketSelector.select:ALPHAUSDC'),
      'pressIn',
    );
    fireEvent(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.addFavorite:ALPHAUSDC',
      ),
      'pressIn',
    );
    rerender(
      <PerpsProMarketRow
        favorite={false}
        model={second}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        selected={false}
      />,
    );
    fireEvent.press(
      screen.getByLabelText('page.perps.pro.marketSelector.select:BETAUSDC'),
    );
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.addFavorite:BETAUSDC',
      ),
      { stopPropagation: jest.fn() },
    );
    expect(onToggleFavorite).not.toHaveBeenCalled();

    fireEvent(
      screen.getByLabelText('page.perps.pro.marketSelector.select:BETAUSDC'),
      'pressIn',
    );
    fireEvent.press(
      screen.getByLabelText('page.perps.pro.marketSelector.select:BETAUSDC'),
    );
    expect(onSelect).toHaveBeenCalledWith('hyperliquid::BETA');

    fireEvent(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.addFavorite:BETAUSDC',
      ),
      'pressIn',
    );
    fireEvent.press(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.addFavorite:BETAUSDC',
      ),
      { stopPropagation: jest.fn() },
    );
    expect(onToggleFavorite).toHaveBeenCalledWith('hyperliquid::BETA');
  });

  it('starts realtime only on touch and defers PressOut cancellation for onPress handoff', () => {
    jest.useFakeTimers();
    const model = buildPerpsProMarketRowModel(createMarketData('ALPHA'));
    const onRealtimeIntentCancel = jest.fn();
    const onRealtimeIntentStart = jest.fn();
    const onSelect = jest.fn();
    render(
      <PerpsProMarketRow
        favorite={false}
        model={model}
        onRealtimeIntentCancel={onRealtimeIntentCancel}
        onRealtimeIntentStart={onRealtimeIntentStart}
        onSelect={onSelect}
        onToggleFavorite={jest.fn()}
        selected={false}
      />,
    );
    const row = screen.getByLabelText(
      'page.perps.pro.marketSelector.select:ALPHAUSDC',
    );

    fireEvent(row, 'pressIn');
    fireEvent(row, 'pressOut');
    fireEvent.press(row);
    act(() => jest.runOnlyPendingTimers());
    expect(onRealtimeIntentStart).toHaveBeenCalledWith('hyperliquid::ALPHA');
    expect(onSelect).toHaveBeenCalledWith('hyperliquid::ALPHA');
    expect(onRealtimeIntentCancel).not.toHaveBeenCalled();

    fireEvent(row, 'pressIn');
    fireEvent(row, 'pressOut');
    act(() => jest.runOnlyPendingTimers());
    expect(onRealtimeIntentCancel).toHaveBeenCalledWith('hyperliquid::ALPHA');
    jest.useRealTimers();
  });
});
