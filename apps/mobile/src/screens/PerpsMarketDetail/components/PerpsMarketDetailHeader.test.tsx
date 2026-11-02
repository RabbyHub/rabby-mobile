import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { StoreApi, UseBoundStore } from 'zustand';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { naviReplace } from '@/utils/navigation';
import { PerpsMarketDetailHeader } from './PerpsMarketDetailHeader';

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
jest.mock('./PerpsHeaderTitle', () => ({
  PerpsHeaderTitle: (props: object) => {
    mockHeaderRender(props);
    return require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'market-header',
    });
  },
}));

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
});
