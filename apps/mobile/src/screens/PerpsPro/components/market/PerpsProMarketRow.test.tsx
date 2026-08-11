import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/assets/icons/dapp/icon-star-full.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'favorite-full',
    });
});

jest.mock('@/assets/icons/dapp/icon-star.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'favorite-empty',
    });
});

jest.mock('./PerpsProMarketLogo', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketLogo: ({
      logoUrl,
      marketKey,
    }: {
      logoUrl: string;
      marketKey: string;
    }) =>
      ReactModule.createElement(View, {
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
    return {
      styles: getStyle({ colors2024 }),
    };
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
    expect(screen.getByText('120.00')).toBeTruthy();
    expect(screen.getByText('+20.00%')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'hyperliquid::ALPHA:https://example.test/ALPHA.png',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('favorite-empty')).toBeTruthy();

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
    expect(screen.getByText('80.00')).toBeTruthy();
    expect(screen.getByText('-20.00%')).toBeTruthy();
    expect(
      screen.getByLabelText('hyperliquid::BETA:https://example.test/BETA.png'),
    ).toBeTruthy();
    expect(screen.getByTestId('favorite-full')).toBeTruthy();
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
});
