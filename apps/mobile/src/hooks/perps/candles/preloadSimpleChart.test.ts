import { AppState } from 'react-native';
import { preloadSimpleChart } from './preloadSimpleChart';
import { resetPerpsCandleSourceSnapshotCacheForTests } from './sourceSnapshot';

const mockSnapshot = jest.fn();
jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getSimpleChartPreference: async () => ({
      version: 1,
      style: 'candle',
      range: '1D',
      interval: '15m',
    }),
    getPerpsSDK: () => ({ info: { candleSnapshot: mockSnapshot } }),
  },
}));
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
describe('Simple chart intent prefetch scheduling', () => {
  beforeEach(() => {
    mockSnapshot.mockReset();
    resetPerpsCandleSourceSnapshotCacheForTests();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
  });
  it('shares pending and cached snapshots across repeated press intents', async () => {
    let resolve!: (value: []) => void;
    mockSnapshot.mockReturnValue(
      new Promise(done => {
        resolve = done;
      }),
    );
    preloadSimpleChart('BTC');
    preloadSimpleChart('BTC');
    await flush();
    expect(mockSnapshot).toHaveBeenCalledTimes(1);
    resolve([]);
    await flush();
    preloadSimpleChart('BTC');
    await flush();
    expect(mockSnapshot).toHaveBeenCalledTimes(1);
  });
  it('bounds speculative concurrency and abandons queued work after blur/background', async () => {
    const resolves: Array<(value: []) => void> = [];
    mockSnapshot.mockImplementation(
      () => new Promise(resolve => resolves.push(resolve)),
    );
    let active = true;
    for (let i = 0; i < 10; i++)
      preloadSimpleChart(`COIN${i}`, '15m', () => active);
    await flush();
    expect(mockSnapshot).toHaveBeenCalledTimes(2);
    active = false;
    resolves.forEach(resolve => resolve([]));
    await flush();
    expect(mockSnapshot).toHaveBeenCalledTimes(2);
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'background',
    });
    preloadSimpleChart('ETH', '15m');
    await flush();
    expect(mockSnapshot).toHaveBeenCalledTimes(2);
  });
});
