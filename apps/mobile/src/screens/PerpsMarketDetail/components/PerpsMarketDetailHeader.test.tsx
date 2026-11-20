import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { StoreApi, UseBoundStore } from 'zustand';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { naviReplace } from '@/utils/navigation';
import { PerpsMarketDetailHeader } from './PerpsMarketDetailHeader';
import { createPerpsMarketDetailHeaderSource } from './account/marketDetailHeaderPresentation';

let mockRouteKey = 'detail';
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ key: mockRouteKey }),
}));

jest.mock('@/constant/layout', () => ({
  RootNames: {
    StackTransaction: 'StackTransaction',
    PerpsSearch: 'PerpsSearch',
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({ marketDataMap: {} })),
}));

jest.mock('@/utils/navigation', () => ({ naviReplace: jest.fn() }));

const mockHeaderRender = jest.fn();
jest.mock('./PerpsHeaderTitle', () => {
  const ReactModule = require('react');
  return {
    PerpsHeaderTitle: ReactModule.forwardRef((props: object, ref: unknown) => {
      const [snapshot, update] = ReactModule.useState(null);
      ReactModule.useImperativeHandle(ref, () => ({ update }), []);
      mockHeaderRender(props);
      return ReactModule.createElement(require('react-native').View, {
        ...props,
        snapshot,
        testID: 'market-header',
      });
    }),
  };
});

type HeaderMetadata = {
  displayName?: string;
  logoUrl?: string;
  quoteAsset?: string;
  markPx?: string;
};
const headerStore = perpsStore as unknown as UseBoundStore<
  StoreApi<{ marketDataMap: Record<string, HeaderMetadata> }>
>;

describe('PerpsMarketDetailHeader', () => {
  beforeEach(() => {
    mockRouteKey = 'detail';
    headerStore.setState({ marketDataMap: {} });
    jest.clearAllMocks();
  });

  it('supplies the route coin on the first render without waiting for market data', () => {
    const screen = render(<PerpsMarketDetailHeader market="HYPE" />);

    expect(screen.getByTestId('market-header').props).toMatchObject({
      coin: 'HYPE',
      displayName: 'HYPE',
      popupIsOpen: false,
    });
    expect(mockHeaderRender.mock.calls[0][0]).toMatchObject({
      coin: 'HYPE',
      displayName: 'HYPE',
      logoUrl: undefined,
      quoteCoin: undefined,
    });
  });

  it('fills metadata without subscribing the header to price ticks', () => {
    const screen = render(<PerpsMarketDetailHeader market="HYPE" />);
    const metadata = {
      displayName: 'Hyperliquid',
      logoUrl: 'https://example.test/hype.png',
      quoteAsset: 'USDH',
      markPx: '82',
    };

    act(() => {
      headerStore.setState({ marketDataMap: { HYPE: metadata } });
    });
    expect(screen.getByTestId('market-header').props).toMatchObject({
      coin: 'HYPE',
      displayName: 'Hyperliquid',
      logoUrl: metadata.logoUrl,
      quoteCoin: 'USDH',
    });

    const renderedCount = mockHeaderRender.mock.calls.length;
    act(() => {
      headerStore.setState({
        marketDataMap: { HYPE: { ...metadata, markPx: '83' } },
      });
    });
    expect(mockHeaderRender).toHaveBeenCalledTimes(renderedCount);
  });

  it('uses the next route coin without retaining the previous market metadata', () => {
    headerStore.setState({
      marketDataMap: {
        HYPE: { displayName: 'Hyperliquid', quoteAsset: 'USDH' },
      },
    });
    const screen = render(<PerpsMarketDetailHeader market="HYPE" />);
    screen.rerender(<PerpsMarketDetailHeader market="BTC" />);

    expect(mockHeaderRender.mock.lastCall?.[0]).toMatchObject({
      coin: 'BTC',
      displayName: 'BTC',
      logoUrl: undefined,
      quoteCoin: undefined,
    });
  });

  it('preserves the existing market selector route', () => {
    const screen = render(<PerpsMarketDetailHeader market="HYPE" />);
    fireEvent(screen.getByTestId('market-header'), 'selectCoin');

    expect(naviReplace).toHaveBeenCalledWith('StackTransaction', {
      screen: 'PerpsSearch',
      params: { openFromSource: 'marketDetail', initialTab: 'topVolume' },
    });
  });

  it('connects a stable first-render header to the screen presentation without rerendering its parent', () => {
    const source = createPerpsMarketDetailHeaderSource('detail', 'HYPE');
    const release = source.activate();
    const parentRender = jest.fn();
    const HeaderOwner = () => {
      parentRender();
      return <PerpsMarketDetailHeader market="HYPE" />;
    };
    const screen = render(<HeaderOwner />);
    try {
      const parentCount = parentRender.mock.calls.length;
      act(() => {
        source.presentation.layout(80);
        source.presentation.quote({ price: '$82' }, true);
        source.presentation.scroll(80);
      });
      expect(screen.getByTestId('market-header').props.snapshot).toEqual({
        compact: true,
        quote: { price: '$82' },
      });
      expect(parentRender).toHaveBeenCalledTimes(parentCount);
      act(() => source.presentation.quote({ price: '$83' }, true));
      expect(
        screen.getByTestId('market-header').props.snapshot.quote.price,
      ).toBe('$83');
      expect(parentRender).toHaveBeenCalledTimes(parentCount);
    } finally {
      screen.unmount();
      release();
    }
  });

  it('recovers an already-published snapshot and switches route subscriptions without leaking old quotes', () => {
    const first = createPerpsMarketDetailHeaderSource('detail', 'HYPE');
    const releaseFirst = first.activate();
    const second = createPerpsMarketDetailHeaderSource('next-detail', 'HYPE');
    const releaseSecond = second.activate();
    first.presentation.layout(80);
    first.presentation.quote({ price: '$82' }, true);
    first.presentation.scroll(80);
    const screen = render(<PerpsMarketDetailHeader market="HYPE" />);
    try {
      expect(
        screen.getByTestId('market-header').props.snapshot.quote.price,
      ).toBe('$82');
      mockRouteKey = 'next-detail';
      screen.rerender(<PerpsMarketDetailHeader market="HYPE" />);
      expect(screen.getByTestId('market-header').props.snapshot.compact).toBe(
        false,
      );
      act(() => first.presentation.quote({ price: '$999' }, true));
      expect(screen.getByTestId('market-header').props.snapshot.compact).toBe(
        false,
      );
      act(() => {
        second.presentation.layout(80);
        second.presentation.quote({ price: '$90' }, true);
        second.presentation.scroll(80);
      });
      expect(
        screen.getByTestId('market-header').props.snapshot.quote.price,
      ).toBe('$90');
    } finally {
      screen.unmount();
      releaseFirst();
      releaseSecond();
    }
  });
});
