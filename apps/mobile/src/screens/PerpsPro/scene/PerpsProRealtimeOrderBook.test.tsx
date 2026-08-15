import { render } from '@testing-library/react-native';
import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import React from 'react';

import type { PerpsRealtimeStatus } from '@/hooks/perps/subscriptions/usePerpsFastL2';
import type { PerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';

import type { PerpsProMarket } from '../model/market';
import { PerpsProRealtimeOrderBook } from './PerpsProRealtimeOrderBook';

type FastL2State = {
  book: L2Book | null;
  identity: string;
  status: PerpsRealtimeStatus;
};

let mockFastL2State: FastL2State;
let mockLatestTradeState: { trade: PerpsLatestTrade | null };
let mockRenderedOrderBookProps: Record<string, any> | null;

jest.mock('@/hooks/perps/subscriptions/usePerpsFastL2', () => ({
  usePerpsFastL2: () => mockFastL2State,
}));

jest.mock('@/hooks/perps/subscriptions/usePerpsLatestTrade', () => ({
  usePerpsLatestTrade: () => mockLatestTradeState,
}));

jest.mock('../components/orderbook/PerpsProOrderBook', () => ({
  PerpsProOrderBook: (props: Record<string, any>) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    mockRenderedOrderBookProps = props;
    return ReactModule.createElement(View, { testID: 'order-book' });
  },
}));

jest.mock('../components/funding/PerpsProFundingDetailSheet', () => ({
  PerpsProFundingDetailSheet: () => null,
}));

const liveBook: L2Book = {
  coin: 'BTC',
  levels: [[{ n: 1, px: '100', sz: '2' }], [{ n: 1, px: '101', sz: '3' }]],
  time: 100,
};
const liveTrade: PerpsLatestTrade = {
  coin: 'BTC',
  price: '100.5',
  side: 'buy',
  size: '1',
  tid: 1,
  time: 101,
};
const market = {
  canonicalCoin: 'BTC',
  marketKey: 'perp:BTC',
} as PerpsProMarket;

describe('PerpsProRealtimeOrderBook reconnect display cache', () => {
  beforeEach(() => {
    mockFastL2State = {
      book: liveBook,
      identity: 'BTC:5:null',
      status: 'ready',
    };
    mockLatestTradeState = { trade: liveTrade };
    mockRenderedOrderBookProps = null;
  });

  it('renders a registry-retained snapshot but disables cached price selection', () => {
    const onSelectPrice = jest.fn();
    const view = render(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectPrice={onSelectPrice}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );

    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
    expect(mockRenderedOrderBookProps?.onSelectPrice).toBe(onSelectPrice);

    mockFastL2State = { ...mockFastL2State, status: 'stale' };
    view.rerender(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectPrice={onSelectPrice}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );

    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
    expect(mockRenderedOrderBookProps?.latestTrade).toEqual(liveTrade);
    expect(mockRenderedOrderBookProps?.onSelectPrice).toBeUndefined();

    mockFastL2State = { ...mockFastL2State, book: null };
    mockLatestTradeState = { trade: null };
    view.rerender(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectPrice={onSelectPrice}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );
    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
  });

  it('does not reuse a snapshot after the subscription identity changes', () => {
    const view = render(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );

    mockFastL2State = {
      book: null,
      identity: 'BTC:4:null',
      status: 'loading',
    };
    view.rerender(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 4 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );

    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
  });
});
