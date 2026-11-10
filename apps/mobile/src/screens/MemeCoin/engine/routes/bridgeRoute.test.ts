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

// Fresh modules per test: the limiter lives at module level.
const loadRoute = () => {
  let route: ReturnType<
    typeof import('./bridgeRoute').createBridgeRoute
  >['route'];
  jest.isolateModules(() => {
    const { createBridgeRoute } = require('./bridgeRoute');
    route = createBridgeRoute({
      account: { address: '0xme' } as Account,
    }).route;
  });
  return route!;
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
    await loadRoute().quote(quoteParams);
    expect(mockGetQuoteList.mock.calls.map(call => call[0])).toEqual([
      'lifi',
      'relay',
    ]);
  });

  it('has no quote when every request failed, 429 included', async () => {
    mockGetQuoteList
      .mockRejectedValueOnce(tooManyRequests)
      .mockRejectedValueOnce(new Error('timeout'));
    await expect(loadRoute().quote(quoteParams)).resolves.toBeNull();
  });

  it('uses what came back even if another aggregator got 429', async () => {
    mockGetQuoteList
      .mockRejectedValueOnce(tooManyRequests)
      .mockResolvedValueOnce([bridgeQuote]);
    const quote = await loadRoute().quote(quoteParams);
    expect(quote?.receiveAmount.toString()).toBe('1');
  });

  it('sends at most 10 quote requests per 1.1s across quotes running at once', async () => {
    mockGetAggregatorList.mockResolvedValue(
      ['lifi', 'socket', 'relay', 'across', 'bungee'].map(id => ({ id })),
    );
    mockGetQuoteList.mockResolvedValue([]);
    const route = loadRoute();
    const quotes = Promise.all([0, 1, 2].map(() => route.quote(quoteParams)));
    await jest.advanceTimersByTimeAsync(1099);
    expect(mockGetQuoteList).toHaveBeenCalledTimes(10);
    await jest.advanceTimersByTimeAsync(1);
    await quotes;
    expect(mockGetQuoteList).toHaveBeenCalledTimes(15);
  });
});
