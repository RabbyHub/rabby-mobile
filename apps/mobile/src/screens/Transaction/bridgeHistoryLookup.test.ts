import {
  peekBridgeHistory,
  subscribeBridgeHistory,
} from './bridgeHistoryLookup';
import { historyTxKey } from './utils/bridgeHistory';

const mockPost = jest.fn();

jest.mock('@/core/request', () => ({
  openapi: { request: { post: (...args: unknown[]) => mockPost(...args) } },
}));
jest.mock('@/utils/chain', () => ({ findChain: () => undefined }));

describe('bridgeHistoryLookup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the last successful answer and its time when a later lookup fails', async () => {
    const query = { chain: 'arb', hash: '0xhash' };
    const subscription = subscribeBridgeHistory(jest.fn(), []);
    mockPost.mockResolvedValueOnce({ data: { history_list: [] } });
    subscription.update({
      queries: [query],
      transactionKeys: new Set([historyTxKey(query.chain, query.hash)]),
      pollableKeys: new Set(),
    });
    await jest.advanceTimersByTimeAsync(0);
    const answeredAt = Date.now();
    expect(peekBridgeHistory(query)).toEqual({ history: null, answeredAt });

    await jest.advanceTimersByTimeAsync(60 * 1000);
    mockPost.mockRejectedValueOnce(new Error('network'));
    subscription.refresh();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(peekBridgeHistory(query)).toEqual({ history: null, answeredAt });

    subscription.dispose();
  });
});
