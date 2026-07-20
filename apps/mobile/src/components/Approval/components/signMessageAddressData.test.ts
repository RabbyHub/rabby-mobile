import {
  SIGN_MESSAGE_ADDRESS_ENRICHMENT_CONCURRENCY,
  getSignMessageAddressTagLayouts,
  getSignMessageAddressTagType,
  isSignMessageAddressMalicious,
  resolveSignMessageAddressData,
} from './signMessageAddressData';

jest.mock('p-queue', () => ({
  __esModule: true,
  default: class MockPQueue {
    private concurrency: number;

    constructor(options: { concurrency: number }) {
      this.concurrency = options.concurrency;
    }

    async addAll<T>(tasks: Array<() => Promise<T>>) {
      const results: T[] = [];
      let next = 0;
      const run = async (): Promise<void> => {
        const index = next++;
        if (!tasks[index]) return;
        results[index] = await tasks[index]();
        await run();
      };

      await Promise.all(Array.from({ length: this.concurrency }, () => run()));
      return results;
    }
  },
}));

const malicious = '0xde709f2102306220921060314715629080e2fb77';
const token = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const protocol = '0xe592427a0aece92de3edee1f18e0157c05861564';
const unknown = '0x27b1fdb04752bbc536007a920d24acb045561c26';

describe('sign message address data', () => {
  it('selects at most one tag with danger priority', () => {
    expect(
      getSignMessageAddressTagType({
        isMalicious: true,
        alias: 'Treasury',
        token: {} as never,
        protocol: {} as never,
      }),
    ).toBe('danger');
    expect(
      getSignMessageAddressTagType({
        isMalicious: false,
        alias: 'Treasury',
        token: null,
        protocol: null,
      }),
    ).toBe('info');
    expect(
      getSignMessageAddressTagType({
        isMalicious: false,
        token: {} as never,
        protocol: null,
      }),
    ).toBe('info');
    expect(
      getSignMessageAddressTagType({
        isMalicious: false,
        token: null,
        protocol: null,
      }),
    ).toBeNull();
  });

  it('uses address danger signals for EOAs and phishing for contracts', () => {
    expect(
      isSignMessageAddressMalicious({
        isContract: false,
        addressDesc: { is_scam: true } as never,
        contractInfo: null,
      }),
    ).toBe(true);
    expect(
      isSignMessageAddressMalicious({
        isContract: false,
        addressDesc: { is_danger: true } as never,
        contractInfo: null,
      }),
    ).toBe(true);
    expect(
      isSignMessageAddressMalicious({
        isContract: true,
        addressDesc: null,
        contractInfo: { is_phishing: true } as never,
      }),
    ).toBe(true);
    expect(
      isSignMessageAddressMalicious({
        isContract: true,
        addressDesc: { is_danger: true, is_scam: true } as never,
        contractInfo: { is_phishing: false } as never,
      }),
    ).toBe(false);
  });

  it('resolves unique addresses and leaves failed lookups unblocked', async () => {
    const reject = async () => Promise.reject(new Error('offline'));
    const provider = {
      getAlias: jest.fn(async (address: string) =>
        address === malicious ? 'Treasury' : undefined,
      ),
      getWhitelist: jest.fn(async () => [malicious]),
      getAccountsByPriority: jest.fn(async () => []),
      getAddressSource: jest.fn(async (address: string) =>
        address === malicious ? 'private-key' : null,
      ),
      getAddressDesc: jest.fn(async (address: string) => ({
        id: address,
        born_at: 1,
        usd_value: 0,
        is_danger: null,
        is_spam: null,
        is_scam: address === malicious,
        name: '',
      })),
      getContractInfo: jest.fn(async (address: string) => {
        if (address === token) {
          return {
            is_token: true,
            protocol: null,
            credit: { value: 2_000_000_000, rank_at: 1 },
            is_danger: { auto: null, edit: null },
            is_phishing: null,
          };
        }
        if (address === protocol) {
          return {
            is_token: false,
            protocol: {
              id: 'uniswap',
              name: 'Uniswap',
              logo_url: 'uniswap.svg',
            },
            credit: { value: 1_000_000, rank_at: 2 },
            is_danger: { auto: null, edit: null },
            is_phishing: null,
          };
        }
        if (address === unknown) return reject();
        return null;
      }),
      hasInteraction: jest.fn(async () => true),
      hasTransfer: jest.fn(async () => true),
      getToken: jest.fn(async () => ({
        id: token,
        symbol: 'USDC',
        logo_url: 'usdc.svg',
      })),
    };

    const result = await resolveSignMessageAddressData({
      tokens: [malicious, token, protocol, unknown, token].map(value => ({
        type: 'address' as const,
        value,
      })),
      chain: { serverId: 'eth' } as never,
      accountAddress: '0x341a1fbd51825e5a107db54ccb3166deba145479',
      provider: provider as never,
    });

    expect(result[malicious]).toMatchObject({
      alias: 'Treasury',
      isContract: false,
      isMalicious: true,
      hasTransfer: true,
      onTransferWhitelist: true,
      hasReceiverPrivateKeyInWallet: true,
    });
    expect(result[token]).toMatchObject({
      isContract: true,
      token: { symbol: 'USDC', logo_url: 'usdc.svg' },
    });
    expect(result[protocol]).toMatchObject({
      isContract: true,
      protocol: { name: 'Uniswap', logo_url: 'uniswap.svg' },
      hasInteraction: true,
    });
    expect(result[unknown]).toMatchObject({ isMalicious: false });
    expect(provider.getWhitelist).toHaveBeenCalledTimes(1);
    expect(provider.getAccountsByPriority).toHaveBeenCalledTimes(1);
    expect(provider.getContractInfo).toHaveBeenCalledTimes(4);
  });

  it('bounds enrichment concurrency without dropping addresses', async () => {
    const addresses = Array.from(
      { length: 25 },
      (_, index) => `0x${index.toString(16).padStart(40, '0')}`,
    );
    let activeRequests = 0;
    let peakActiveRequests = 0;
    const provider = {
      getAlias: jest.fn(async () => undefined),
      getWhitelist: jest.fn(async () => []),
      getAccountsByPriority: jest.fn(async () => []),
      getAddressSource: jest.fn(async () => null),
      getAddressDesc: jest.fn(async () => {
        activeRequests += 1;
        peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
        await new Promise(resolve => setTimeout(resolve, 0));
        activeRequests -= 1;
        return null;
      }),
      getContractInfo: jest.fn(async () => null),
      hasInteraction: jest.fn(async () => false),
      hasTransfer: jest.fn(async () => false),
      getToken: jest.fn(async () => null),
    };

    const result = await resolveSignMessageAddressData({
      tokens: addresses.map(value => ({ type: 'address' as const, value })),
      chain: { serverId: 'eth' } as never,
      accountAddress: malicious,
      provider: provider as never,
    });

    expect(Object.keys(result)).toHaveLength(addresses.length);
    expect(provider.getAddressDesc).toHaveBeenCalledTimes(addresses.length);
    expect(peakActiveRequests).toBeLessThanOrEqual(
      SIGN_MESSAGE_ADDRESS_ENRICHMENT_CONCURRENCY,
    );
  });

  it('places tagged addresses on their rendered text lines', () => {
    const tokens = [
      { type: 'text' as const, value: 'Send to ' },
      { type: 'address' as const, value: malicious },
      { type: 'text' as const, value: ' and ' },
      { type: 'address' as const, value: token },
      { type: 'text' as const, value: '\nthen ' },
      { type: 'address' as const, value: protocol },
    ];

    expect(
      getSignMessageAddressTagLayouts(
        tokens,
        [1, 3, 5],
        [
          { text: `Send to ${malicious} and ${token}`, y: 0, height: 16 },
          { text: `then ${protocol}`, y: 16, height: 16 },
        ],
      ),
    ).toEqual([
      { index: 1, right: -6, top: 0 },
      { index: 3, right: 38, top: 0 },
      { index: 5, right: -6, top: 16 },
    ]);
  });
});
