import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

import { buildPerpsProMarket } from '../../model/market';
import { processPerpsOrderBook } from '../../model/orderBook';
import { PerpsProOrderBook } from './PerpsProOrderBook';

jest.mock('@/assets2024/icons/perps/PerpsProPrecisionCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
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

jest.mock('../funding/PerpsProFundingSummary', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProFundingSummary: () =>
      ReactModule.createElement(View, { testID: 'funding-summary' }),
  };
});

jest.mock('../loading/PerpsProSkeletonBlock', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProSkeletonBlock: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'perps-pro-skeleton-block',
      }),
  };
});

jest.mock('./PerpsProPrecisionSheet', () => ({
  PerpsProPrecisionSheet: () => null,
}));

const defaultProps: React.ComponentProps<typeof PerpsProOrderBook> = {
  book: processPerpsOrderBook(null),
  bookStatus: 'loading',
  hasBookSnapshot: false,
  latestTrade: null,
  market: null,
  onOpenFunding: jest.fn(),
  onSelectTickOption: jest.fn(),
  selectedTickOption: null,
  serverClock: null,
  tickOptions: [],
};

const marketData: MarketData = {
  dayBaseVlm: '100',
  dayNtlVlm: '1000000',
  dexId: '',
  displayName: 'BTC',
  funding: '0.0001',
  index: 0,
  logoUrl: '',
  markPx: '31.3426',
  maxLeverage: 40,
  maxUsdValueSize: '1000000',
  midPx: '31.3426',
  minLeverage: 1,
  name: 'BTC',
  openInterest: '1',
  oraclePx: '31.3426',
  premium: '0',
  prevDayPx: '30',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 4,
};

describe('PerpsProOrderBook display shell', () => {
  it('keeps the fixed body mounted while display state changes', () => {
    const view = render(<PerpsProOrderBook {...defaultProps} />);

    expect(screen.getByTestId('perps-pro-order-book')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-order-book-skeleton')).toBeTruthy();
    expect(
      screen.getAllByTestId('perps-pro-skeleton-block').length,
    ).toBeGreaterThan(0);

    view.rerender(
      <PerpsProOrderBook
        {...defaultProps}
        bookStatus="error"
        hasBookSnapshot={false}
      />,
    );

    expect(screen.getByTestId('perps-pro-order-book')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-order-book-skeleton')).toBeNull();
    expect(screen.getByText('page.perps.pro.common.unavailable')).toBeTruthy();

    view.rerender(
      <PerpsProOrderBook
        {...defaultProps}
        bookStatus="stale"
        hasBookSnapshot={false}
      />,
    );

    expect(screen.getByTestId('perps-pro-order-book')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-order-book-skeleton')).toBeTruthy();
  });

  it('keeps market prices at pxDecimals when order-book aggregation is coarser', () => {
    const view = render(
      <PerpsProOrderBook
        {...defaultProps}
        book={processPerpsOrderBook({
          coin: 'BTC',
          levels: [
            [{ n: 1, px: '31.044', sz: '2' }],
            [{ n: 1, px: '31.556', sz: '3' }],
          ],
          time: 100,
        })}
        bookStatus="ready"
        hasBookSnapshot
        latestTrade={{
          coin: 'BTC',
          price: '31.3314',
          side: 'buy',
          size: '1',
          tid: 1,
          time: 100,
        }}
        market={buildPerpsProMarket(marketData)}
        selectedTickOption={{
          displayPrice: 1,
          mantissa: null,
          nSigFigs: 2,
          priceDecimals: 0,
        }}
      />,
    );

    expect(screen.getByText('31')).toBeTruthy();
    expect(screen.getByText('32')).toBeTruthy();
    expect(screen.getByText('31.33')).toBeTruthy();
    expect(screen.getByText('31.34')).toBeTruthy();

    view.rerender(
      <PerpsProOrderBook
        {...defaultProps}
        book={processPerpsOrderBook({
          coin: 'BTC',
          levels: [
            [{ n: 1, px: '31.044', sz: '2' }],
            [{ n: 1, px: '31.556', sz: '3' }],
          ],
          time: 100,
        })}
        bookStatus="ready"
        hasBookSnapshot
        latestTrade={{
          coin: 'BTC',
          price: '31.3314',
          side: 'buy',
          size: '1',
          tid: 1,
          time: 100,
        }}
        market={buildPerpsProMarket(marketData)}
        selectedTickOption={{
          displayPrice: 0.01,
          mantissa: null,
          nSigFigs: 4,
          priceDecimals: 2,
        }}
      />,
    );

    expect(screen.getByText('31.04')).toBeTruthy();
    expect(screen.getByText('31.56')).toBeTruthy();
    expect(screen.getByText('31.33')).toBeTruthy();
    expect(screen.getByText('31.34')).toBeTruthy();
  });

  it('keeps both ask and bid amounts at two decimals independently of the tick', () => {
    const book = processPerpsOrderBook({
      coin: 'BTC',
      levels: [
        [{ n: 1, px: '1000', sz: '14080' }],
        [{ n: 1, px: '2000', sz: '74950' }],
      ],
      time: 100,
    });
    const view = render(
      <PerpsProOrderBook
        {...defaultProps}
        book={book}
        bookStatus="ready"
        hasBookSnapshot
        market={buildPerpsProMarket(marketData)}
        selectedTickOption={{
          displayPrice: 1000,
          mantissa: null,
          nSigFigs: 2,
          priceDecimals: 0,
        }}
      />,
    );

    expect(screen.getByText('14.08M')).toBeTruthy();
    expect(screen.getByText('149.90M')).toBeTruthy();

    const amountStyle = StyleSheet.flatten(
      screen.getByText('149.90M').props.style,
    );
    expect(amountStyle.flexShrink).toBe(0);
    expect(amountStyle.maxWidth).toBeUndefined();

    const priceStyle = StyleSheet.flatten(
      screen.getByText('2,000').props.style,
    );
    expect(priceStyle.flex).toBe(1);
    expect(priceStyle.minWidth).toBe(0);

    view.rerender(
      <PerpsProOrderBook
        {...defaultProps}
        book={book}
        bookStatus="ready"
        hasBookSnapshot
        market={buildPerpsProMarket(marketData)}
        selectedTickOption={{
          displayPrice: 1,
          mantissa: null,
          nSigFigs: 5,
          priceDecimals: 2,
        }}
      />,
    );

    expect(screen.getByText('14.08M')).toBeTruthy();
    expect(screen.getByText('149.90M')).toBeTruthy();
    expect(screen.getByText('2,000.00')).toBeTruthy();
  });
});
