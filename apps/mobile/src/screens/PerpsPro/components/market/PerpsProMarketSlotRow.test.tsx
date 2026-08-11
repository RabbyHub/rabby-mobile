import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockRowRender = jest.fn();

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const { create } = require('zustand');
  const createMarketData = (name: string, markPx: string) => ({
    brief: `${name} full name`,
    dayBaseVlm: '1',
    dayNtlVlm: '1000',
    dexId: '',
    displayName: name,
    funding: '0.0001',
    index: name === 'ALPHA' ? 0 : 1,
    logoUrl: `https://example.test/${name}.png`,
    markPx,
    maxLeverage: 20,
    maxUsdValueSize: '1000000',
    midPx: markPx,
    minLeverage: 1,
    name,
    openInterest: '1',
    oraclePx: markPx,
    premium: '0',
    prevDayPx: '100',
    pxDecimals: 2,
    quoteAsset: 'USDC',
    szDecimals: 2,
  });
  const initialMarketDataMap = {
    ALPHA: createMarketData('ALPHA', '120'),
    BETA: createMarketData('BETA', '80'),
  };
  const perpsStore = create(() => ({
    marketDataMap: initialMarketDataMap,
  }));

  return {
    __getInitialMarketDataMap: () => initialMarketDataMap,
    __setMarketDataMap: (marketDataMap: typeof initialMarketDataMap) => {
      perpsStore.setState({ marketDataMap });
    },
    perpsStore,
  };
});

jest.mock('./PerpsProMarketRow', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    PerpsProMarketRow: ({
      model,
    }: {
      model: {
        displayPair: string;
        marketKey: string;
        price: number | null;
      };
    }) => {
      mockRowRender(model);
      return ReactModule.createElement(
        Text,
        { testID: 'connected-market-row' },
        `${model.marketKey}:${model.price}`,
      );
    },
  };
});

const { PerpsProMarketSlotRow } =
  require('./PerpsProMarketSlotRow') as typeof import('./PerpsProMarketSlotRow');
type MarketDataMap = import('@/hooks/perps/usePerpsStore').MarketDataMap;
const { __getInitialMarketDataMap, __setMarketDataMap } = jest.requireMock(
  '@/hooks/perps/usePerpsStore',
) as {
  __getInitialMarketDataMap: () => MarketDataMap;
  __setMarketDataMap: (marketDataMap: MarketDataMap) => void;
};

const renderSlotRow = (
  canonicalCoin: string,
  marketKey: string,
  onPrefetch?: (coin: string) => void,
) => (
  <PerpsProMarketSlotRow
    canonicalCoin={canonicalCoin}
    favorite={false}
    marketKey={marketKey}
    onPrefetch={onPrefetch}
    onSelect={jest.fn()}
    onToggleFavorite={jest.fn()}
    selected={false}
  />
);

describe('PerpsProMarketSlotRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      __setMarketDataMap(__getInitialMarketDataMap());
    });
  });

  it('ignores unrelated and shallow-equal snapshots but updates its own market', () => {
    render(renderSlotRow('ALPHA', 'hyperliquid::ALPHA'));
    expect(screen.getByText('hyperliquid::ALPHA:120')).toBeTruthy();
    expect(mockRowRender).toHaveBeenCalledTimes(1);

    const initial = __getInitialMarketDataMap();
    act(() => {
      __setMarketDataMap({
        ...initial,
        BETA: { ...initial.BETA, markPx: '90' },
      });
    });
    expect(mockRowRender).toHaveBeenCalledTimes(1);

    act(() => {
      __setMarketDataMap({
        ...initial,
        ALPHA: { ...initial.ALPHA },
      });
    });
    expect(mockRowRender).toHaveBeenCalledTimes(1);

    act(() => {
      __setMarketDataMap({
        ...initial,
        ALPHA: { ...initial.ALPHA, markPx: '150' },
      });
    });
    expect(screen.getByText('hyperliquid::ALPHA:150')).toBeTruthy();
    expect(mockRowRender).toHaveBeenCalledTimes(2);
  });

  it('resolves the new business identity when a physical slot is rebound', () => {
    const { rerender } = render(renderSlotRow('ALPHA', 'hyperliquid::ALPHA'));

    rerender(renderSlotRow('BETA', 'hyperliquid::BETA'));

    expect(screen.getByText('hyperliquid::BETA:80')).toBeTruthy();
  });

  it('prefetches each mounted business identity before it can be selected', () => {
    const onPrefetch = jest.fn();
    const { rerender } = render(
      renderSlotRow('ALPHA', 'hyperliquid::ALPHA', onPrefetch),
    );
    expect(onPrefetch).toHaveBeenCalledWith('ALPHA');

    rerender(renderSlotRow('BETA', 'hyperliquid::BETA', onPrefetch));
    expect(onPrefetch).toHaveBeenCalledWith('BETA');
  });
});
