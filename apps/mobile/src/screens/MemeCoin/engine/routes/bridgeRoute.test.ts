import BigNumber from 'bignumber.js';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/startupServices/preference';

const mockGetQuoteList = jest.fn();
const mockGetAggregatorList = jest.fn();
const mockResolveArrival = jest.fn();
const mockCompleteBridgeTx = jest.fn(async () => undefined);
const mockLookup = {
  subscription: { update: jest.fn(), refresh: jest.fn(), dispose: jest.fn() },
  onChange: undefined as undefined | (() => void),
  /** chain:hash -> the lookup's last answer (null: answered, nothing found) */
  answers: new Map<string, unknown>(),
};

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
  transactionHistoryServiceApi: {
    addBridgeTxHistory: async () => undefined,
    completeBridgeTxHistory: (...args: unknown[]) =>
      mockCompleteBridgeTx(...args),
  },
}));
jest.mock('@/screens/Transaction/bridgeHistoryLookup', () => ({
  subscribeBridgeHistory: (onChange: () => void) => {
    mockLookup.onChange = onChange;
    return mockLookup.subscription;
  },
  peekBridgeHistory: (query: { chain: string; hash: string }) =>
    mockLookup.answers.get(`${query.chain}:${query.hash}`),
}));
jest.mock('@/screens/Bridge/hooks/bridge', () => ({
  buildBridgeToken: jest.fn(),
}));
jest.mock('@/screens/Bridge/utils/bridgeApproval', () => ({
  getBridgeQuoteApproval: async () => ({}),
}));
jest.mock('@/screens/Bridge/utils/bridgeArrival', () => ({
  resolveBridgeArrival: (...args: unknown[]) => mockResolveArrival(...args),
}));
jest.mock('@/screens/Bridge/utils/bridgeQuote', () => ({
  getBestBridgeQuote: (list: unknown[]) =>
    list.length ? { quote: list[0] } : undefined,
}));
jest.mock('@/screens/Swap/hooks/fee', () => ({
  getRabbyFeeInfo: () => ({ feeRate: '0' }),
}));
jest.mock('@/utils/chain', () => ({ findChainByServerID: () => undefined }));

const tooManyRequests = { response: { status: 429 } };
const bridgeQuote = {
  to_token_amount: '1',
  duration: 60,
  aggregator: { id: 'lifi' },
  bridge: { id: 'b', logo_url: 'logo', name: 'B' },
};

const quoteParams = {
  payToken: { id: 'usdc', chain: 'arb', decimals: 6, price: 1 } as TokenItem,
  receiveToken: { id: 'pepe', chain: 'base', decimals: 18 } as TokenItem,
  payAmount: new BigNumber(10),
  slippagePct: 2.5,
};

// Fresh modules per test: the limiter lives at module level. The error class
// comes from the same fresh registry, so instanceof still holds.
const loadBridgeRoute = () => {
  let loaded: ReturnType<typeof import('./bridgeRoute').createBridgeRoute> & {
    StoppedError: typeof import('../pauseGate').ExecutionStoppedError;
  };
  jest.isolateModules(() => {
    const { createBridgeRoute } = require('./bridgeRoute');
    loaded = {
      ...createBridgeRoute({ account: { address: '0xme' } as Account }),
      StoppedError: require('../pauseGate').ExecutionStoppedError,
    };
  });
  return loaded!;
};
const loadRoute = () => loadBridgeRoute().route;

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

describe('bridge route arrival', () => {
  const key = 'arb:0xhash';
  const leg = {
    key: 'l',
    kind: 'bridge',
    pay: { id: 'usdc', chain: 'arb', symbol: 'USDC' },
    receive: { id: 'pepe', chain: 'base', symbol: 'PEPE' },
    amountUsd: 10,
    payAll: false,
  } as const;

  const broadcast = async () => {
    mockGetQuoteList.mockResolvedValue([bridgeQuote]);
    const loaded = loadBridgeRoute();
    const quote = await loaded.route.quote(quoteParams);
    await quote!.onBroadcast!('0xhash');
    return loaded;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetQuoteList.mockReset();
    mockGetAggregatorList.mockResolvedValue([{ id: 'lifi' }]);
    mockResolveArrival.mockReset();
    mockCompleteBridgeTx.mockClear();
    mockLookup.subscription.update.mockClear();
    mockLookup.subscription.refresh.mockClear();
    mockLookup.subscription.dispose.mockClear();
    mockLookup.answers.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('watches the bridge through the shared lookup and settles when it completes', async () => {
    const { waitForArrival } = await broadcast();
    const arrived = waitForArrival({
      leg,
      txHash: '0xhash',
      isCancelled: () => false,
    });
    expect(mockLookup.subscription.update).toHaveBeenCalledWith({
      queries: [{ chain: 'arb', hash: '0xhash' }],
      transactionKeys: new Set([key]),
      pollableKeys: new Set([key]),
    });

    const bridgeTx = { to_actual_token: { id: 'pepe' } };
    mockLookup.answers.set(key, { status: 'completed' });
    mockResolveArrival.mockReturnValue({
      type: 'settled',
      status: 'allSuccess',
      bridgeTx,
    });
    mockLookup.onChange!();
    await expect(arrived).resolves.toBe(true);
    expect(mockCompleteBridgeTx).toHaveBeenCalledWith(
      '0xhash',
      0,
      'allSuccess',
      bridgeTx,
    );
    expect(mockLookup.subscription.dispose).toHaveBeenCalled();
  });

  it('asks again while nothing is found, and times out only on an answered lookup', async () => {
    const { waitForArrival } = await broadcast();
    const arrived = waitForArrival({
      leg,
      txHash: '0xhash',
      isCancelled: () => false,
    });
    await jest.advanceTimersByTimeAsync(3000);
    expect(mockLookup.subscription.refresh).toHaveBeenCalledTimes(1);
    expect(mockResolveArrival).not.toHaveBeenCalled();

    mockLookup.answers.set(key, null);
    mockResolveArrival.mockReturnValue({ type: 'notFoundTimeout' });
    await jest.advanceTimersByTimeAsync(3000);
    await expect(arrived).resolves.toBe(false);
    expect(mockCompleteBridgeTx).toHaveBeenCalledWith('0xhash', 0, 'failed');
  });

  it('stops and lets go of the lookup once cancelled', async () => {
    const { waitForArrival, StoppedError } = await broadcast();
    let cancelled = false;
    const arrived = waitForArrival({
      leg,
      txHash: '0xhash',
      isCancelled: () => cancelled,
    });
    const settled = expect(arrived).rejects.toBeInstanceOf(StoppedError);
    cancelled = true;
    await jest.advanceTimersByTimeAsync(3000);
    await settled;
    expect(mockLookup.subscription.dispose).toHaveBeenCalled();
  });
});
