const mockDefaultEthRPC = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('@/core/serviceApi/customRPC', () => ({
  customRPCServiceApi: {
    defaultEthRPC: (...args: unknown[]) => mockDefaultEthRPC(...args),
  },
}));

// keeps the keyring/native deps out of this suite; enum values are their own names
jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: new Proxy({}, { get: (_t, key: string) => key }),
}));

jest.mock('@/utils/chain', () => ({
  findChain: ({ enum: chainEnum }: { enum: string }) => ({
    serverId: String(chainEnum).toLowerCase(),
  }),
}));

jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: () => ({ address: '0xfrom' }),
}));

jest.mock('@/constant', () => ({ INTERNAL_REQUEST_SESSION: {} }));
jest.mock('@/core/controllers/provider', () => ({ default: {} }));
jest.mock('@/core/serviceApi/notification', () => ({
  ensureNotificationServiceReady: jest.fn(),
  setCurrentMiniApprovalSync: jest.fn(),
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {},
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('./sendRequest', () => ({ sendRequest: jest.fn() }));
jest.mock('./recommendNonce', () => ({ getRecommendNonce: jest.fn() }));

import { fetchEstimatedL1Fee } from './provider';

const txParams = {
  chainId: 2818,
  from: '0x2739f6e5fcf169b14d4529a35e95242577189560',
  to: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d',
  value: '0x0',
  gas: '0x169be',
  gasPrice: '0x3d4780',
  data: '0x',
};

describe('fetchEstimatedL1Fee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDefaultEthRPC.mockResolvedValue('0x1');
  });

  it.each([
    ['SCRL', 'scrl', '0x5300000000000000000000000000000000000002'],
    ['MORPH', 'morph', '0x530000000000000000000000000000000000000f'],
  ])('queries the %s l1 gas oracle', async (chain, serverId, oracle) => {
    await expect(
      fetchEstimatedL1Fee({ txParams, account: null as never }, chain as never),
    ).resolves.toBe('0x1');

    const [call] = mockDefaultEthRPC.mock.calls;
    expect(call[0].chainServerId).toBe(serverId);
    expect(call[0].method).toBe('eth_call');
    expect(call[0].params[0].to).toBe(oracle);
    // getL1Fee(bytes)
    expect(call[0].params[0].data.startsWith('0x49948e0e')).toBe(true);
  });

  it('rethrows when the oracle fails, reporting it once', async () => {
    mockDefaultEthRPC.mockRejectedValue(new Error('execution reverted'));

    // a failed estimate must not read as a zero fee: that under-reserves gas
    // and the node rejects the broadcast
    await expect(
      fetchEstimatedL1Fee(
        { txParams, account: null as never },
        'MORPH' as never,
      ),
    ).rejects.toThrow('execution reverted');
    await expect(
      fetchEstimatedL1Fee(
        { txParams, account: null as never },
        'MORPH' as never,
      ),
    ).rejects.toThrow('execution reverted');

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][1]).toEqual({
      tags: { scene: 'l1Fee', chain: 'MORPH' },
    });
  });

  it('returns 0x0 for chains without an l1 fee', async () => {
    await expect(
      fetchEstimatedL1Fee({ txParams, account: null as never }, 'ETH' as never),
    ).resolves.toBe('0x0');
    expect(mockDefaultEthRPC).not.toHaveBeenCalled();
  });
});
