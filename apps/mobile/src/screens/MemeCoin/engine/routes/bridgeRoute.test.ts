import BigNumber from 'bignumber.js';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/startupServices/preference';

const mockGetQuoteList = jest.fn();
const mockGetAggregatorList = jest.fn();

jest.mock('@rabby-wallet/rabby-bridge', () => ({
  buildTx: jest.fn(),
  getQuoteList: (...args: unknown[]) => mockGetQuoteList(...args),
  isSupportedBridgeAggregator: () => true,
  isSupportedBridgeChain: (id: string) => id !== 'mayan',
}));
jest.mock('@/core/request', () => ({
  openapi: { getBridgeAggregatorList: () => mockGetAggregatorList() },
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {},
}));
jest.mock('@/screens/Bridge/hooks/bridge', () => ({
  buildBridgeToken: jest.fn(),
}));
jest.mock('@/screens/Bridge/utils/bridgeApproval', () => ({
  getBridgeQuoteApproval: async () => ({}),
}));
jest.mock('@/screens/Bridge/utils/bridgeArrival', () => ({
  resolveBridgeArrival: jest.fn(),
}));
jest.mock('@/screens/Bridge/utils/bridgeQuote', () => ({
  getBestBridgeQuote: (list: unknown[]) =>
    list.length ? { quote: list[0] } : undefined,
}));
jest.mock('@/screens/Swap/hooks/fee', () => ({
  getRabbyFeeInfo: () => ({ feeRate: '0' }),
}));
jest.mock('@/utils/async', () => ({ sleep: jest.fn() }));
jest.mock('@/utils/chain', () => ({ findChainByServerID: () => undefined }));

const tooManyRequests = { response: { status: 429 } };
const bridgeQuote = {
  to_token_amount: '1',
  bridge: { id: 'b', logo_url: 'logo', name: 'B' },
};

const quoteParams = {
  payToken: { id: 'usdc', chain: 'arb', decimals: 6, price: 1 } as TokenItem,
  receiveToken: { id: 'pepe', chain: 'base', decimals: 18 } as TokenItem,
  payAmount: new BigNumber(10),
  slippagePct: 2.5,
};

// Fresh modules per test: the limiter and backoff live at module level. The
// error class comes from the same fresh registry, so instanceof still holds.
const loadRoute = () => {
  let loaded: {
    route: ReturnType<
      typeof import('./bridgeRoute').createBridgeRoute
    >['route'];
    RateLimitedError: typeof import('../quoteRateLimit').QuoteRateLimitedError;
  };
  jest.isolateModules(() => {
    const { createBridgeRoute } = require('./bridgeRoute');
    loaded = {
      route: createBridgeRoute({ account: { address: '0xme' } as Account })
        .route,
      RateLimitedError: require('../quoteRateLimit').QuoteRateLimitedError,
    };
  });
  return loaded!;
};

describe('bridge route quote', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetQuoteList.mockReset();
    mockGetAggregatorList.mockResolvedValue([
      { id: 'lifi' },
      { id: 'relay' },
      { id: 'mayan' },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('only asks the aggregators that support the pay chain', async () => {
    mockGetQuoteList.mockResolvedValue([]);
    await loadRoute().route.quote(quoteParams);
    expect(mockGetQuoteList.mock.calls.map(call => call[0])).toEqual([
      'lifi',
      'relay',
    ]);
  });

  it('is rate limited when nothing came back and a request got 429', async () => {
    mockGetQuoteList
      .mockRejectedValueOnce(tooManyRequests)
      .mockResolvedValueOnce([]);
    const { route, RateLimitedError } = loadRoute();
    await expect(route.quote(quoteParams)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it('has no quote when the requests failed for other reasons', async () => {
    mockGetQuoteList.mockRejectedValue(new Error('timeout'));
    await expect(loadRoute().route.quote(quoteParams)).resolves.toBeNull();
  });

  it('uses what came back even if another aggregator got 429', async () => {
    mockGetQuoteList
      .mockRejectedValueOnce(tooManyRequests)
      .mockResolvedValueOnce([bridgeQuote]);
    const quote = await loadRoute().route.quote(quoteParams);
    expect(quote?.receiveAmount.toString()).toBe('1');
  });

  it('holds the next quote for 15s after a 429', async () => {
    const { route, RateLimitedError } = loadRoute();
    mockGetQuoteList.mockRejectedValue(tooManyRequests);
    await expect(route.quote(quoteParams)).rejects.toBeInstanceOf(
      RateLimitedError,
    );

    mockGetQuoteList.mockReset();
    mockGetQuoteList.mockResolvedValue([bridgeQuote]);
    const next = route.quote(quoteParams);
    await jest.advanceTimersByTimeAsync(14999);
    expect(mockGetQuoteList).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await expect(next).resolves.not.toBeNull();
    expect(mockGetQuoteList).toHaveBeenCalledTimes(2);
  });
});
