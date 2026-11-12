import { chaintable } from '@/core/chaintable';
import {
  refreshMemeHoldings,
  refreshMemeHoldingsIfStale,
  useMemeHoldingsStore,
} from './memeHoldingsStore';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/core/chaintable', () => ({
  chaintable: { getMemeUserTokenList: jest.fn() },
}));

const fetchHoldings = chaintable.getMemeUserTokenList as jest.Mock;
const MAX_AGE = 1000;
const settle = () => new Promise(resolve => setImmediate(resolve));

let now = 0;

beforeEach(() => {
  now = 10000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  fetchHoldings.mockReset();
  fetchHoldings.mockResolvedValue({ positions: [], total_usd_value: 5 });
  useMemeHoldingsStore.setState({ byAddress: {}, failedByAddress: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('refreshMemeHoldingsIfStale', () => {
  it('loads an address that has no data yet', async () => {
    refreshMemeHoldingsIfStale('0xABC', MAX_AGE);
    await settle();
    expect(fetchHoldings).toHaveBeenCalledWith('0xabc');
  });

  it('skips while the last load is newer than the max age', async () => {
    await refreshMemeHoldings('0xabc');
    fetchHoldings.mockClear();

    now += MAX_AGE - 1;
    refreshMemeHoldingsIfStale('0xABC', MAX_AGE);
    await settle();
    expect(fetchHoldings).not.toHaveBeenCalled();
  });

  it('refreshes once the last load reaches the max age', async () => {
    await refreshMemeHoldings('0xabc');
    fetchHoldings.mockClear();

    now += MAX_AGE;
    refreshMemeHoldingsIfStale('0xabc', MAX_AGE);
    await settle();
    expect(fetchHoldings).toHaveBeenCalledTimes(1);
  });

  it('retries right away after a first load that failed', async () => {
    fetchHoldings.mockRejectedValueOnce(new Error('network'));
    await refreshMemeHoldings('0xabc');
    fetchHoldings.mockClear();

    refreshMemeHoldingsIfStale('0xabc', MAX_AGE);
    await settle();
    expect(fetchHoldings).toHaveBeenCalledTimes(1);
  });
});
