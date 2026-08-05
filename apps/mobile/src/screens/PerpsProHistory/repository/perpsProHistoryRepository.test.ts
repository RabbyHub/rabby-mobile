import {
  createPerpsProHistoryRepository,
  loadPerpsProHistoryInclusiveWindow,
} from './perpsProHistoryRepository';

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: jest.fn(),
  },
}));

const makeTimedItem = (time: number, id = String(time)) => ({ id, time });

describe('Perps Pro history repository', () => {
  it('continues from an inclusive boundary and deduplicates it', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce([
        makeTimedItem(0),
        makeTimedItem(1),
        makeTimedItem(2),
      ])
      .mockResolvedValueOnce([makeTimedItem(2), makeTimedItem(3)]);

    const result = await loadPerpsProHistoryInclusiveWindow({
      endTime: 10,
      fetchPage,
      getKey: item => item.id,
      getTime: item => item.time,
      limit: 10,
      pageSizeHint: 3,
      startTime: 0,
    });

    expect(fetchPage.mock.calls).toEqual([
      [0, 10],
      [2, 10],
    ]);
    expect(result).toMatchObject({
      completed: true,
      stalled: false,
      truncated: false,
    });
    expect(result.items.map(item => item.time)).toEqual([0, 1, 2, 3]);
  });

  it('terminates a full inclusive page that makes no key or cursor progress', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce([makeTimedItem(0), makeTimedItem(1)])
      .mockResolvedValueOnce([makeTimedItem(1), makeTimedItem(1, '1')]);
    const result = await loadPerpsProHistoryInclusiveWindow({
      endTime: 10,
      fetchPage,
      getKey: item => item.id,
      getTime: item => item.time,
      limit: 10,
      pageSizeHint: 2,
      startTime: 0,
    });
    expect(result).toMatchObject({ completed: false, stalled: true });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('narrows an over-cap cashflow window toward its latest end', async () => {
    const getUserNonFundingLedgerUpdates = jest.fn(
      (_address: string, startTime: number) =>
        Promise.resolve(
          startTime < 50
            ? [10, 20, 90].map(time => ({
                delta: { type: 'deposit', usdc: String(time) },
                hash: `0x${time}`,
                time,
              }))
            : [
                {
                  delta: { type: 'deposit', usdc: '90' },
                  hash: '0x90',
                  time: 90,
                },
              ],
        ),
    );
    const unsubscribe = jest.fn();
    const repository = createPerpsProHistoryRepository({
      getInfoClient: () =>
        ({
          getUserFills: jest.fn(),
          getUserFillsByTime: jest.fn(),
          getUserFunding: jest.fn(),
          getUserHistoricalOrders: jest.fn(),
          getUserNonFundingLedgerUpdates,
        } as any),
      getWsClient: () =>
        ({
          subscribeToUserFunding: jest.fn(() => ({ unsubscribe })),
          subscribeToUserHistoricalOrders: jest.fn(() => ({ unsubscribe })),
        } as any),
    });

    const result = await repository.fetchTransactionsWindow(
      '0x1111111111111111111111111111111111111111',
      { endTime: 100, startTime: 0 },
      2,
    );

    expect(
      getUserNonFundingLedgerUpdates.mock.calls.map(call => call[1]),
    ).toEqual([0, 50]);
    expect(result).toMatchObject({
      completed: true,
      truncated: false,
      window: { endTime: 100, startTime: 50 },
    });
    expect(result.items.map(item => item.time)).toEqual([90]);
  });

  it('gates support on the fills-by-time method and makes WS cleanup idempotent', () => {
    const unsubscribe = jest.fn();
    const subscribeToUserHistoricalOrders = jest.fn(() => ({ unsubscribe }));
    const repository = createPerpsProHistoryRepository({
      getInfoClient: () =>
        ({
          getUserFills: jest.fn(),
          getUserFunding: jest.fn(),
          getUserHistoricalOrders: jest.fn(),
          getUserNonFundingLedgerUpdates: jest.fn(),
        } as any),
      getWsClient: () =>
        ({
          subscribeToUserFunding: jest.fn(),
          subscribeToUserHistoricalOrders,
        } as any),
    });
    expect(repository.isSupported()).toBe(false);
    const cleanup = repository.subscribeOrders(jest.fn());
    cleanup();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
