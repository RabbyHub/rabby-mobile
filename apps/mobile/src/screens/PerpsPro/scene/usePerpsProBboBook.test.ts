import { act, renderHook } from '@testing-library/react-native';

const mockHandlers = new Map<string, Set<() => void>>();
const mockSubscriptions: Array<{
  callback: (book: {
    coin: string;
    levels: Array<Array<{ n: number; px: string; sz: string }>>;
    time: number;
  }) => void;
  coin: string;
  unsubscribe: jest.Mock;
}> = [];

const mockWs = {
  off: jest.fn((event: string, callback: () => void) => {
    mockHandlers.get(event)?.delete(callback);
  }),
  on: jest.fn((event: string, callback: () => void) => {
    const handlers = mockHandlers.get(event) ?? new Set();
    handlers.add(callback);
    mockHandlers.set(event, handlers);
  }),
  subscribeToL2Book: jest.fn(
    (
      { coin }: { coin: string },
      callback: (book: {
        coin: string;
        levels: Array<Array<{ n: number; px: string; sz: string }>>;
        time: number;
      }) => void,
    ) => {
      const unsubscribe = jest.fn();
      mockSubscriptions.push({ callback, coin, unsubscribe });
      return { unsubscribe };
    },
  ),
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: () => ({ ws: mockWs }) },
}));

import { usePerpsProBboBook } from './usePerpsProBboBook';

const book = (coin: string, time = 1) => ({
  coin,
  levels: [
    ['99', '98', '97', '96', '95'].map(px => ({ n: 1, px, sz: '1' })),
    ['101', '102', '103', '104', '105'].map(px => ({ n: 1, px, sz: '1' })),
  ],
  time,
});

describe('usePerpsProBboBook', () => {
  beforeEach(() => {
    mockHandlers.clear();
    mockSubscriptions.length = 0;
    jest.clearAllMocks();
  });

  it('publishes the unaggregated snapshot and invalidates it on connection loss', () => {
    const { result } = renderHook(() =>
      usePerpsProBboBook({ coin: 'BTC', enabled: true }),
    );
    expect(mockSubscriptions[0]?.coin).toBe('BTC');

    act(() => mockSubscriptions[0].callback(book('BTC')));
    expect(result.current).toMatchObject({
      prices: { asks1: '101', asks5: '105', bids1: '99', bids5: '95' },
      status: 'ready',
    });
    expect(result.current.sessionKey).toMatch(/^BTC:/u);

    act(() => {
      mockHandlers.get('close')?.forEach(handler => handler());
    });
    expect(result.current).toMatchObject({
      prices: { asks1: null, asks5: null, bids1: null, bids5: null },
      sessionKey: null,
      status: 'stale',
    });
  });

  it('unsubscribes and ignores the previous market callback after a switch', () => {
    const { rerender, result } = renderHook(
      ({ coin }) => usePerpsProBboBook({ coin, enabled: true }),
      { initialProps: { coin: 'BTC' } },
    );
    const btcSubscription = mockSubscriptions[0];

    rerender({ coin: 'ETH' });
    expect(btcSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions[1]?.coin).toBe('ETH');

    act(() => btcSubscription.callback(book('BTC', 2)));
    expect(result.current.status).toBe('loading');
    expect(result.current.sessionKey).toBeNull();

    act(() => mockSubscriptions[1].callback(book('ETH', 3)));
    expect(result.current.status).toBe('ready');
    expect(result.current.sessionKey).toMatch(/^ETH:/u);
  });
});
