import {
  loadFirstDailyCandle,
  resetFirstDailyCandleCacheForTests,
} from './firstDailyCandle';
const mockSnapshot = jest.fn();
jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({ info: { candleSnapshot: mockSnapshot } }),
  },
}));
const day = (t: number, o = '10', v = '0') => ({
  t,
  o,
  h: '20',
  l: '1',
  c: '12',
  v,
  n: 0,
});
beforeEach(() => {
  resetFirstDailyCandleCacheForTests();
  mockSnapshot.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());
it('requests all available daily data and accepts a zero-volume first day', async () => {
  mockSnapshot.mockResolvedValue([day(2000), day(1000, '8'), day(0, '0')]);
  const first = loadFirstDailyCandle('DOGE');
  expect(loadFirstDailyCandle('DOGE')).toBe(first);
  expect(await first).toEqual({ time: 1, open: 8 });
  expect(mockSnapshot).toHaveBeenCalledWith('DOGE', '1d', 0, Date.now());
  expect(await loadFirstDailyCandle('DOGE')).toEqual({ time: 1, open: 8 });
  expect(mockSnapshot).toHaveBeenCalledTimes(1);
});
it('does not invent a price after errors or empty data, and permits a later retry', async () => {
  mockSnapshot
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([])
    .mockResolvedValue([day(0)]);
  expect(await loadFirstDailyCandle('BTC')).toBeNull();
  expect(await loadFirstDailyCandle('BTC')).toBeNull();
  expect(mockSnapshot).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(15000);
  expect(await loadFirstDailyCandle('BTC')).toBeNull();
  jest.advanceTimersByTime(15000);
  expect(await loadFirstDailyCandle('BTC')).toEqual({ time: 0, open: 10 });
});
it('bounds the cache and does not let an obsolete request overwrite a newer one', async () => {
  let release!: (value: unknown[]) => void;
  mockSnapshot
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    )
    .mockResolvedValue([day(2000)]);
  const old = loadFirstDailyCandle('BTC');
  await Promise.resolve();
  jest.advanceTimersByTime(15000);
  expect(await loadFirstDailyCandle('BTC')).toEqual({ time: 2, open: 10 });
  release([day(1000)]);
  await old;
  expect(await loadFirstDailyCandle('BTC')).toEqual({ time: 2, open: 10 });
  for (let i = 0; i < 24; i++) await loadFirstDailyCandle(`coin-${i}`);
  await loadFirstDailyCandle('BTC');
  expect(mockSnapshot).toHaveBeenCalledTimes(27);
});
