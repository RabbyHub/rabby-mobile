import { act, render } from '@testing-library/react-native';
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

type LatestTradeState = {
  identity: string;
  status: PerpsRealtimeStatus;
  trade: PerpsLatestTrade | null;
};

let mockFastL2State: FastL2State;
let mockLatestTradeState: LatestTradeState;
let mockRenderedOrderBookProps: Record<string, any> | null;
const mockPrewarmHttpSnapshot = jest.fn(() => Promise.resolve(true));
const mockWaitForHttpSnapshot = jest.fn(() => Promise.resolve(true));

jest.mock('@/hooks/perps/subscriptions/usePerpsFastL2', () => ({
  PERPS_FAST_L2_DISPLAY_CACHE_MS: 3000,
  prewarmPerpsFastL2HttpSnapshot: (...args: unknown[]) =>
    mockPrewarmHttpSnapshot(...args),
  usePerpsFastL2: () => mockFastL2State,
  waitForPerpsFastL2HttpSnapshot: (...args: unknown[]) =>
    mockWaitForHttpSnapshot(...args),
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
    mockLatestTradeState = {
      identity: 'BTC',
      status: 'ready',
      trade: liveTrade,
    };
    mockRenderedOrderBookProps = null;
    mockPrewarmHttpSnapshot.mockReset().mockResolvedValue(true);
    mockWaitForHttpSnapshot.mockReset().mockResolvedValue(true);
  });

  it('keeps display caches visible but gates each price source by its own readiness', () => {
    const onSelectPrice = jest.fn();
    const onSelectPriceIntentStart = jest.fn(() => ({
      type: 'tradePrice' as const,
    }));
    const view = render(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectPrice={onSelectPrice}
        onSelectPriceIntentStart={onSelectPriceIntentStart}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );

    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
    expect(mockRenderedOrderBookProps?.bookIdentity).toBe('BTC:5:null');
    expect(mockRenderedOrderBookProps?.latestTradeIdentity).toBe('BTC');
    expect(mockRenderedOrderBookProps?.onSelectBookPrice).toEqual(
      expect.any(Function),
    );
    expect(mockRenderedOrderBookProps?.onSelectLatestTradePrice).toEqual(
      expect.any(Function),
    );
    expect(mockRenderedOrderBookProps?.onSelectPriceIntentStart).toBe(
      onSelectPriceIntentStart,
    );

    mockRenderedOrderBookProps?.onSelectBookPrice(
      '100',
      { type: 'tradePrice' },
      {
        feedIdentity: 'BTC:5:null',
        marketKey: market.marketKey,
        type: 'book',
      },
    );
    expect(onSelectPrice).toHaveBeenCalledWith('100', {
      type: 'tradePrice',
    });

    mockFastL2State = { ...mockFastL2State, status: 'stale' };
    view.rerender(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectPrice={onSelectPrice}
        onSelectPriceIntentStart={onSelectPriceIntentStart}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );

    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
    expect(mockRenderedOrderBookProps?.latestTrade).toEqual(liveTrade);
    expect(mockRenderedOrderBookProps?.onSelectBookPrice).toBeUndefined();
    expect(mockRenderedOrderBookProps?.onSelectLatestTradePrice).toEqual(
      expect.any(Function),
    );

    mockFastL2State = { ...mockFastL2State, status: 'ready' };
    mockLatestTradeState = { ...mockLatestTradeState, status: 'stale' };
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
    expect(mockRenderedOrderBookProps?.onSelectBookPrice).toEqual(
      expect.any(Function),
    );
    expect(
      mockRenderedOrderBookProps?.onSelectLatestTradePrice,
    ).toBeUndefined();

    mockFastL2State = { ...mockFastL2State, book: null, status: 'stale' };
    mockLatestTradeState = {
      ...mockLatestTradeState,
      status: 'stale',
      trade: null,
    };
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
    expect(mockRenderedOrderBookProps?.onSelectBookPrice).toBeUndefined();
    expect(
      mockRenderedOrderBookProps?.onSelectLatestTradePrice,
    ).toBeUndefined();
  });

  it('rejects a frozen press when its market or feed identity changes before release', () => {
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
    const pressedBookSelection = mockRenderedOrderBookProps?.onSelectBookPrice;
    const pressedLatestSelection =
      mockRenderedOrderBookProps?.onSelectLatestTradePrice;

    mockFastL2State = {
      ...mockFastL2State,
      identity: 'BTC:4:null',
    };
    view.rerender(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectPrice={onSelectPrice}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 4 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );
    pressedBookSelection(
      '100',
      { type: 'tradePrice' },
      {
        feedIdentity: 'BTC:5:null',
        marketKey: market.marketKey,
        type: 'book',
      },
    );
    expect(onSelectPrice).not.toHaveBeenCalled();

    const nextMarket = {
      ...market,
      canonicalCoin: 'ETH',
      marketKey: 'perp:ETH',
    } as PerpsProMarket;
    mockLatestTradeState = {
      ...mockLatestTradeState,
      identity: 'ETH',
    };
    view.rerender(
      <PerpsProRealtimeOrderBook
        enabled
        market={nextMarket}
        onSelectPrice={onSelectPrice}
        onSelectTickOption={jest.fn()}
        precision={{ mantissa: null, nSigFigs: 4 }}
        selectedTickOption={null}
        tickOptions={[]}
      />,
    );
    pressedLatestSelection(
      '100.5',
      { type: 'tradePrice' },
      {
        feedIdentity: 'BTC',
        marketKey: market.marketKey,
        type: 'latestTrade',
      },
    );
    expect(onSelectPrice).not.toHaveBeenCalled();
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

  it('prewarms and commits a precision only after the bounded exact snapshot wait', async () => {
    const selected = {
      displayPrice: 1,
      mantissa: null,
      nSigFigs: 5,
      priceDecimals: 0,
    } as const;
    const target = {
      displayPrice: 10,
      mantissa: null,
      nSigFigs: 4,
      priceDecimals: 0,
    } as const;
    const onSelectTickOption = jest.fn();
    let resolveWait!: (value: boolean) => void;
    mockWaitForHttpSnapshot.mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          resolveWait = resolve;
        }),
    );
    render(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectTickOption={onSelectTickOption}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={selected}
        tickOptions={[selected, target]}
      />,
    );

    mockRenderedOrderBookProps?.onPrecisionIntentStart(target);
    expect(mockPrewarmHttpSnapshot).toHaveBeenCalledWith({
      coin: 'BTC',
      precision: { mantissa: null, nSigFigs: 4 },
    });
    expect(onSelectTickOption).not.toHaveBeenCalled();

    act(() => {
      mockRenderedOrderBookProps?.onSelectTickOption(target);
    });
    expect(mockWaitForHttpSnapshot).toHaveBeenCalledWith({
      coin: 'BTC',
      precision: { mantissa: null, nSigFigs: 4 },
      timeoutMs: 250,
    });
    expect(onSelectTickOption).not.toHaveBeenCalled();

    await act(async () => {
      resolveWait(true);
      await Promise.resolve();
    });
    expect(onSelectTickOption).toHaveBeenCalledWith(target);
  });

  it('lets selecting the still-current precision cancel a pending target', async () => {
    const selected = {
      displayPrice: 1,
      mantissa: null,
      nSigFigs: 5,
      priceDecimals: 0,
    } as const;
    const target = {
      displayPrice: 10,
      mantissa: null,
      nSigFigs: 4,
      priceDecimals: 0,
    } as const;
    const onSelectTickOption = jest.fn();
    let resolveWait!: (value: boolean) => void;
    mockWaitForHttpSnapshot.mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          resolveWait = resolve;
        }),
    );
    render(
      <PerpsProRealtimeOrderBook
        enabled
        market={market}
        onSelectTickOption={onSelectTickOption}
        precision={{ mantissa: null, nSigFigs: 5 }}
        selectedTickOption={selected}
        tickOptions={[selected, target]}
      />,
    );

    act(() => mockRenderedOrderBookProps?.onSelectTickOption(target));
    act(() => mockRenderedOrderBookProps?.onSelectTickOption(selected));
    await act(async () => {
      resolveWait(true);
      await Promise.resolve();
    });

    expect(onSelectTickOption).not.toHaveBeenCalled();
  });
});
