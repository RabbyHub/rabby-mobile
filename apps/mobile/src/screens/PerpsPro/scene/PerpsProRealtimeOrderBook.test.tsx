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
let mockRenderedFundingProps: Record<string, any> | null;
const mockOrderBookRender = jest.fn();
const mockFastL2Arguments = jest.fn();
const mockLatestTradeArguments = jest.fn();
const mockPrewarmHttpSnapshot = jest.fn(() => Promise.resolve(true));
const mockWaitForHttpSnapshot = jest.fn(() => Promise.resolve(true));

jest.mock('@/hooks/perps/subscriptions/usePerpsFastL2', () => ({
  PERPS_FAST_L2_DISPLAY_CACHE_MS: 3000,
  prewarmPerpsFastL2HttpSnapshot: (...args: unknown[]) =>
    mockPrewarmHttpSnapshot(...args),
  usePerpsFastL2: (options: unknown) => {
    mockFastL2Arguments(options);
    return mockFastL2State;
  },
  waitForPerpsFastL2HttpSnapshot: (...args: unknown[]) =>
    mockWaitForHttpSnapshot(...args),
}));

jest.mock('@/hooks/perps/subscriptions/usePerpsLatestTrade', () => ({
  usePerpsLatestTrade: (options: unknown) => {
    mockLatestTradeArguments(options);
    return mockLatestTradeState;
  },
}));

jest.mock('../components/orderbook/PerpsProOrderBook', () => ({
  PerpsProOrderBook: (props: Record<string, any>) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    mockRenderedOrderBookProps = props;
    mockOrderBookRender(props);
    return ReactModule.createElement(View, { testID: 'order-book' });
  },
}));

jest.mock('../components/funding/PerpsProFundingDetailSheet', () => ({
  PerpsProFundingDetailSheet: (props: Record<string, any>) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    mockRenderedFundingProps = props;
    return ReactModule.createElement(View, { testID: 'funding-detail-sheet' });
  },
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

const orderBook = (
  overrides: Partial<
    React.ComponentProps<typeof PerpsProRealtimeOrderBook>
  > = {},
) => (
  <PerpsProRealtimeOrderBook
    enabled
    market={market}
    onSelectTickOption={jest.fn()}
    precision={{ mantissa: null, nSigFigs: 5 }}
    selectedTickOption={null}
    tickOptions={[]}
    {...overrides}
  />
);

const expectPublication = (
  publicationEnabled: boolean,
  { coin = 'BTC', enabled = true } = {},
) => {
  expect(mockFastL2Arguments).toHaveBeenLastCalledWith({
    coin,
    enabled,
    precision: { mantissa: null, nSigFigs: 5 },
    publicationEnabled,
  });
  expect(mockLatestTradeArguments).toHaveBeenLastCalledWith({
    coin,
    enabled,
    publicationEnabled,
  });
};

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
    mockRenderedFundingProps = null;
    mockOrderBookRender.mockClear();
    mockFastL2Arguments.mockClear();
    mockLatestTradeArguments.mockClear();
    mockPrewarmHttpSnapshot.mockReset().mockResolvedValue(true);
    mockWaitForHttpSnapshot.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retains only the inactive exact-market presentation, never live price readiness', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const onSelectPrice = jest.fn();
    const view = render(orderBook({ onSelectPrice }));
    const first = mockRenderedOrderBookProps!;
    const oldPriceHandler = first.onSelectBookPrice;
    mockFastL2State = { book: null, identity: 'disabled', status: 'idle' };
    mockLatestTradeState = {
      trade: null,
      identity: 'disabled',
      status: 'idle',
    };
    view.rerender(
      orderBook({ sceneActive: false, enabled: false, onSelectPrice }),
    );

    expectPublication(false, { enabled: false });
    expect(mockRenderedOrderBookProps?.book).toBe(first.book);
    expect(mockRenderedOrderBookProps?.latestTrade).toBe(liveTrade);
    expect(mockRenderedOrderBookProps?.serverClock).toBe(first.serverClock);
    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
    expect(mockRenderedOrderBookProps?.bookStatus).toBe('idle');
    expect(mockRenderedOrderBookProps?.bookIdentity).toBe('disabled');
    expect(mockRenderedOrderBookProps?.onSelectBookPrice).toBeUndefined();
    expect(
      mockRenderedOrderBookProps?.onSelectLatestTradePrice,
    ).toBeUndefined();
    oldPriceHandler(
      '100',
      { type: 'tradePrice' },
      {
        type: 'book',
        marketKey: market.marketKey,
        feedIdentity: 'BTC:5:null',
      },
    );
    expect(onSelectPrice).not.toHaveBeenCalled();

    mockFastL2State = { book: null, identity: 'BTC:5:null', status: 'loading' };
    mockLatestTradeState = { trade: null, identity: 'BTC', status: 'loading' };
    view.rerender(orderBook({ onSelectPrice }));
    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
    expect(mockRenderedOrderBookProps?.latestTrade).toBeNull();
    expect(mockRenderedOrderBookProps?.serverClock).toBeNull();
    expect(mockRenderedOrderBookProps?.onSelectBookPrice).toBeUndefined();
  });

  it('keeps first-visit inactive previews empty until an actual successful feed', () => {
    mockFastL2State = { book: null, identity: 'disabled', status: 'idle' };
    mockLatestTradeState = {
      trade: null,
      identity: 'disabled',
      status: 'idle',
    };
    const view = render(orderBook({ sceneActive: false, enabled: false }));
    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
    expect(mockRenderedOrderBookProps?.serverClock).toBeNull();
    mockFastL2State = {
      book: liveBook,
      identity: 'BTC:5:null',
      status: 'stale',
    };
    view.rerender(orderBook());
    mockFastL2State = { book: null, identity: 'disabled', status: 'idle' };
    view.rerender(orderBook({ sceneActive: false, enabled: false }));
    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
  });

  it.each(['market', 'precision'] as const)(
    'discards retained presentation across a %s identity change, including a return to the old key',
    identity => {
      const view = render(orderBook());
      mockFastL2State = { book: null, identity: 'disabled', status: 'idle' };
      mockLatestTradeState = {
        trade: null,
        identity: 'disabled',
        status: 'idle',
      };
      const inactive = { sceneActive: false, enabled: false };
      view.rerender(orderBook(inactive));
      expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
      view.rerender(
        orderBook({
          ...inactive,
          ...(identity === 'market'
            ? {
                market: {
                  ...market,
                  marketKey: 'perp:ETH',
                  canonicalCoin: 'ETH',
                },
              }
            : { precision: { nSigFigs: 4, mantissa: null } }),
        }),
      );
      expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
      expect(mockRenderedOrderBookProps?.latestTrade).toBeNull();
      expect(mockRenderedOrderBookProps?.serverClock).toBeNull();
      view.rerender(orderBook(inactive));
      expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(false);
      expect(mockRenderedOrderBookProps?.serverClock).toBeNull();
    },
  );

  it('releases funding sheet ownership while inactive and ignores its retained opener', () => {
    const view = render(orderBook());
    const open = mockRenderedOrderBookProps?.onOpenFunding;
    act(() => open());
    expect(view.queryByTestId('funding-detail-sheet')).not.toBeNull();
    view.rerender(orderBook({ sceneActive: false, enabled: false }));
    expect(view.queryByTestId('funding-detail-sheet')).toBeNull();
    act(() => open());
    view.rerender(orderBook());
    expect(view.queryByTestId('funding-detail-sheet')).toBeNull();
  });

  it('does not commit a late precision intent after an inactive/active round trip', async () => {
    const onSelectTickOption = jest.fn();
    const target = {
      displayPrice: 10,
      mantissa: null,
      nSigFigs: 4,
      priceDecimals: 0,
    } as const;
    let resolveWait!: (value: boolean) => void;
    mockWaitForHttpSnapshot.mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          resolveWait = resolve;
        }),
    );
    const view = render(orderBook({ onSelectTickOption }));
    act(() => mockRenderedOrderBookProps?.onSelectTickOption(target));
    view.rerender(
      orderBook({ sceneActive: false, enabled: false, onSelectTickOption }),
    );
    act(() => mockRenderedOrderBookProps?.onSelectTickOption(target));
    expect(mockWaitForHttpSnapshot).toHaveBeenCalledTimes(1);
    view.rerender(orderBook({ onSelectTickOption }));
    await act(async () => {
      resolveWait(true);
      await Promise.resolve();
    });
    expect(onSelectTickOption).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'defaults viewport publication to the source enabled=%s contract',
    enabled => {
      render(orderBook({ enabled }));
      expectPublication(enabled, { enabled });
    },
  );

  it('pauses and resumes only display publication as the book leaves and reenters the viewport', () => {
    const view = render(orderBook({ publicationEnabled: true }));
    expectPublication(true);

    view.rerender(
      orderBook({ publicationEnabled: true, viewportVisible: false }),
    );
    expectPublication(false);

    view.rerender(
      orderBook({ publicationEnabled: true, viewportVisible: true }),
    );
    expectPublication(true);
    expect(view.queryByTestId('order-book')).not.toBeNull();
  });

  it('keeps offscreen funding details current and pauses again when they close', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const view = render(orderBook({ publicationEnabled: true }));
    act(() => mockRenderedOrderBookProps?.onOpenFunding());
    view.rerender(
      orderBook({ publicationEnabled: true, viewportVisible: false }),
    );
    expectPublication(true);
    expect(view.queryByTestId('funding-detail-sheet')).not.toBeNull();

    now.mockReturnValue(2000);
    mockFastL2State = {
      ...mockFastL2State,
      book: { ...liveBook, time: 102 },
    };
    mockOrderBookRender.mockClear();
    view.rerender(
      orderBook({ publicationEnabled: true, viewportVisible: false }),
    );
    expectPublication(true);
    expect(mockOrderBookRender).toHaveBeenCalledTimes(1);
    expect(mockRenderedFundingProps?.serverClock).toEqual({
      marketKey: market.marketKey,
      receivedAt: 2000,
      serverTime: 102,
    });
    expect(mockRenderedFundingProps?.serverClock).toBe(
      mockRenderedOrderBookProps?.serverClock,
    );

    now.mockReturnValue(3000);
    mockLatestTradeState = {
      ...mockLatestTradeState,
      trade: { ...liveTrade, time: 103 },
    };
    view.rerender(
      orderBook({ publicationEnabled: true, viewportVisible: false }),
    );
    expect(mockRenderedFundingProps?.serverClock).toEqual({
      marketKey: market.marketKey,
      receivedAt: 3000,
      serverTime: 103,
    });
    expect(mockRenderedFundingProps?.serverClock).toBe(
      mockRenderedOrderBookProps?.serverClock,
    );

    act(() => mockRenderedFundingProps?.onClose());
    expectPublication(false);
    expect(view.queryByTestId('funding-detail-sheet')).toBeNull();
  });

  it.each([true, false])(
    'never lets funding details bypass outer publication=false with viewportVisible=%s',
    viewportVisible => {
      const view = render(
        orderBook({ publicationEnabled: false, viewportVisible }),
      );
      expectPublication(false);
      act(() => mockRenderedOrderBookProps?.onOpenFunding());
      expectPublication(false);
      expect(view.queryByTestId('funding-detail-sheet')).not.toBeNull();

      view.rerender(orderBook({ publicationEnabled: true, viewportVisible }));
      expectPublication(true);
      view.rerender(orderBook({ publicationEnabled: false, viewportVisible }));
      expectPublication(false);

      act(() => mockRenderedFundingProps?.onClose());
      expectPublication(false);
      expect(view.queryByTestId('funding-detail-sheet')).toBeNull();
    },
  );

  it('closes funding details on market change and restores the offscreen publication gate', () => {
    const view = render(
      orderBook({ publicationEnabled: true, viewportVisible: false }),
    );
    expectPublication(false);
    act(() => mockRenderedOrderBookProps?.onOpenFunding());
    expectPublication(true);

    const nextMarket = {
      ...market,
      canonicalCoin: 'ETH',
      marketKey: 'perp:ETH',
    };
    mockFastL2State = {
      ...mockFastL2State,
      book: { ...liveBook, coin: 'ETH' },
      identity: 'ETH:5:null',
    };
    mockLatestTradeState = {
      ...mockLatestTradeState,
      identity: 'ETH',
      trade: { ...liveTrade, coin: 'ETH' },
    };
    view.rerender(
      orderBook({
        market: nextMarket,
        publicationEnabled: true,
        viewportVisible: false,
      }),
    );

    expect(view.queryByTestId('funding-detail-sheet')).toBeNull();
    expectPublication(false, { coin: 'ETH' });
  });

  it('publishes the new server clock in the snapshot render without a second commit', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const view = render(orderBook());

    expect(mockOrderBookRender).toHaveBeenCalledTimes(1);
    expect(mockRenderedOrderBookProps?.serverClock).toEqual({
      marketKey: market.marketKey,
      receivedAt: 1000,
      serverTime: 101,
    });

    now.mockReturnValue(2000);
    mockOrderBookRender.mockClear();
    mockFastL2State = {
      ...mockFastL2State,
      book: { ...liveBook, time: 102 },
    };
    view.rerender(orderBook());

    expect(mockOrderBookRender).toHaveBeenCalledTimes(1);
    expect(mockOrderBookRender.mock.calls[0][0].serverClock).toEqual({
      marketKey: market.marketKey,
      receivedAt: 2000,
      serverTime: 102,
    });
  });

  it('preserves the clock identity and receivedAt when only snapshot data changes', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const view = render(orderBook());
    const firstClock = mockRenderedOrderBookProps?.serverClock;

    now.mockReturnValue(2000);
    mockFastL2State = {
      ...mockFastL2State,
      book: { ...liveBook, levels: [[], []], time: 101 },
    };
    view.rerender(orderBook({ market: { ...market } }));

    expect(mockRenderedOrderBookProps?.serverClock).toBe(firstClock);
    expect(mockRenderedOrderBookProps?.serverClock.receivedAt).toBe(1000);
    expect(mockRenderedOrderBookProps?.hasBookSnapshot).toBe(true);
  });

  it('refreshes the clock for a later trade time and for a new market at the same time', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const view = render(orderBook());
    const firstClock = mockRenderedOrderBookProps?.serverClock;

    now.mockReturnValue(2000);
    mockLatestTradeState = {
      ...mockLatestTradeState,
      trade: { ...liveTrade, time: 102 },
    };
    view.rerender(orderBook());
    const laterClock = mockRenderedOrderBookProps?.serverClock;
    expect(laterClock).not.toBe(firstClock);
    expect(laterClock).toEqual({
      marketKey: market.marketKey,
      receivedAt: 2000,
      serverTime: 102,
    });

    now.mockReturnValue(3000);
    const nextMarket = {
      ...market,
      canonicalCoin: 'ETH',
      marketKey: 'perp:ETH',
    };
    mockFastL2State = {
      ...mockFastL2State,
      book: { ...liveBook, coin: 'ETH' },
      identity: 'ETH:5:null',
    };
    mockLatestTradeState = {
      ...mockLatestTradeState,
      identity: 'ETH',
      trade: { ...liveTrade, coin: 'ETH', time: 102 },
    };
    view.rerender(orderBook({ market: nextMarket }));

    expect(mockRenderedOrderBookProps?.serverClock).not.toBe(laterClock);
    expect(mockRenderedOrderBookProps?.serverClock).toEqual({
      marketKey: nextMarket.marketKey,
      receivedAt: 3000,
      serverTime: 102,
    });
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'clears the clock in the same render when the effective server time is %s',
    time => {
      const view = render(orderBook());
      expect(mockRenderedOrderBookProps?.serverClock).not.toBeNull();
      mockOrderBookRender.mockClear();
      mockFastL2State = {
        ...mockFastL2State,
        book: time == null ? null : { ...liveBook, time },
      };
      mockLatestTradeState = { ...mockLatestTradeState, trade: null };

      view.rerender(orderBook());

      expect(mockOrderBookRender).toHaveBeenCalledTimes(1);
      expect(mockOrderBookRender.mock.calls[0][0].serverClock).toBeNull();
    },
  );

  it('keeps funding callbacks stable across snapshots and still opens and closes the sheet', () => {
    const view = render(orderBook());
    const openFunding = mockRenderedOrderBookProps?.onOpenFunding;
    expect(mockRenderedFundingProps).toBeNull();

    act(() => openFunding());
    expect(mockRenderedFundingProps).not.toBeNull();
    const closeFunding = mockRenderedFundingProps?.onClose;

    mockFastL2State = {
      ...mockFastL2State,
      book: { ...liveBook, time: 102 },
    };
    view.rerender(orderBook());

    expect(mockRenderedOrderBookProps?.onOpenFunding).toBe(openFunding);
    expect(mockRenderedFundingProps?.onClose).toBe(closeFunding);
    expect(mockRenderedFundingProps?.serverClock).toBe(
      mockRenderedOrderBookProps?.serverClock,
    );
    act(() => closeFunding());
    expect(view.queryByTestId('funding-detail-sheet')).toBeNull();

    act(() => openFunding());
    expect(mockRenderedFundingProps?.onClose).toBe(closeFunding);
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

  it.each([
    ['book', 'stale'],
    ['book', 'error'],
    ['latestTrade', 'stale'],
    ['latestTrade', 'error'],
  ] as const)(
    'rejects a retained %s selection handler after its feed becomes %s',
    (sourceType, status) => {
      const onSelectPrice = jest.fn();
      const view = render(orderBook({ onSelectPrice }));
      const retainedBookSelection =
        mockRenderedOrderBookProps?.onSelectBookPrice;
      const retainedLatestSelection =
        mockRenderedOrderBookProps?.onSelectLatestTradePrice;
      const bookSource = {
        feedIdentity: 'BTC:5:null',
        marketKey: market.marketKey,
        type: 'book',
      };
      const latestSource = {
        feedIdentity: 'BTC',
        marketKey: market.marketKey,
        type: 'latestTrade',
      };
      const intent = { type: 'tradePrice' };

      retainedBookSelection('100', intent, bookSource);
      retainedLatestSelection('100.5', intent, latestSource);
      expect(onSelectPrice).toHaveBeenCalledTimes(2);
      onSelectPrice.mockClear();

      if (sourceType === 'book') {
        mockFastL2State = { ...mockFastL2State, status };
      } else {
        mockLatestTradeState = { ...mockLatestTradeState, status };
      }
      view.rerender(orderBook({ onSelectPrice }));

      if (sourceType === 'book') {
        expect(mockRenderedOrderBookProps?.onSelectBookPrice).toBeUndefined();
        retainedBookSelection('100', intent, bookSource);
        expect(onSelectPrice).not.toHaveBeenCalled();

        retainedLatestSelection('100.5', intent, latestSource);
        expect(onSelectPrice).toHaveBeenCalledWith('100.5', intent);
      } else {
        expect(
          mockRenderedOrderBookProps?.onSelectLatestTradePrice,
        ).toBeUndefined();
        retainedLatestSelection('100.5', intent, latestSource);
        expect(onSelectPrice).not.toHaveBeenCalled();

        retainedBookSelection('100', intent, bookSource);
        expect(onSelectPrice).toHaveBeenCalledWith('100', intent);
      }
      expect(onSelectPrice).toHaveBeenCalledTimes(1);
    },
  );

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
