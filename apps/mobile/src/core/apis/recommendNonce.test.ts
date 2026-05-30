const mockFindChain = jest.fn();
const mockIsTempoChain = jest.fn();
const mockRequestReadOnlyETHRpc = jest.fn();
const mockGetNonceByChain = jest.fn();
const mockTranslate = jest.fn((key: string) => `translated:${key}`);
const mockEncodeFunctionData = jest.fn(() => '0xencodedNonceCall');
const mockDecodeFunctionResult = jest.fn(() => 31n);

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

jest.mock('@/utils/tempoChain', () => ({
  isTempoChain: (...args: unknown[]) => mockIsTempoChain(...args),
}));

jest.mock('@/core/services', () => ({
  transactionHistoryService: {
    getNonceByChain: (...args: unknown[]) => mockGetNonceByChain(...args),
  },
}));

jest.mock('./readOnlyRpc', () => ({
  requestReadOnlyETHRpc: (...args: unknown[]) =>
    mockRequestReadOnlyETHRpc(...args),
}));

jest.mock('i18next', () => ({
  t: (...args: unknown[]) => mockTranslate(...args),
}));

jest.mock('viem', () => ({
  encodeFunctionData: (...args: unknown[]) => mockEncodeFunctionData(...args),
  decodeFunctionResult: (...args: unknown[]) =>
    mockDecodeFunctionResult(...args),
}));

jest.mock('viem/tempo', () => ({
  Abis: {
    nonce: [{ type: 'function', name: 'getNonce' }],
  },
  Addresses: {
    nonceManager: '0x0000000000000000000000000000000000001000',
  },
}));

import { getRecommendNonce } from './recommendNonce';

describe('getRecommendNonce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindChain.mockReturnValue({
      id: 1,
      serverId: 'eth',
    });
    mockIsTempoChain.mockReturnValue(false);
    mockRequestReadOnlyETHRpc.mockResolvedValue('0x9');
    mockGetNonceByChain.mockResolvedValue(0);
  });

  it('throws a translated invalid-chain error when chain id is unknown', async () => {
    mockFindChain.mockReturnValue(null);

    await expect(
      getRecommendNonce({
        from: '0xabc',
        chainId: 999_999,
        account: null,
      }),
    ).rejects.toThrow('translated:background.error.invalidChainId');

    expect(mockTranslate).toHaveBeenCalledWith(
      'background.error.invalidChainId',
    );
    expect(mockRequestReadOnlyETHRpc).not.toHaveBeenCalled();
  });

  it('uses the larger value between on-chain and local nonce for normal chains', async () => {
    mockRequestReadOnlyETHRpc.mockResolvedValue('0x9');
    mockGetNonceByChain.mockResolvedValue(12);

    await expect(
      getRecommendNonce({
        from: '0xabc',
        chainId: 1,
        account: { address: '0xabc' } as never,
      }),
    ).resolves.toBe('0xc');

    expect(mockRequestReadOnlyETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_getTransactionCount',
        params: ['0xabc', 'latest'],
      },
      'eth',
      { address: '0xabc' },
    );
    expect(mockGetNonceByChain).toHaveBeenCalledWith('0xabc', 1);
  });

  it('falls back to transaction count when a Tempo nonce key is empty or non-positive', async () => {
    mockFindChain.mockReturnValue({
      id: 777,
      serverId: 'tempo',
    });
    mockIsTempoChain.mockReturnValue(true);

    await expect(
      getRecommendNonce({
        from: '0xabc',
        chainId: 777,
        account: null,
        nonceKey: '0x',
      }),
    ).resolves.toBe('0x9');

    expect(mockEncodeFunctionData).not.toHaveBeenCalled();
    expect(mockRequestReadOnlyETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_getTransactionCount',
        params: ['0xabc', 'latest'],
      },
      'tempo',
      null,
    );
  });

  it('reads Tempo nonce manager when a positive nonce key is provided', async () => {
    mockFindChain.mockReturnValue({
      id: 777,
      serverId: 'tempo',
    });
    mockIsTempoChain.mockReturnValue(true);
    mockRequestReadOnlyETHRpc.mockResolvedValue('0xencodedNonceResult');

    await expect(
      getRecommendNonce({
        from: '0xabc',
        chainId: 777,
        account: null,
        nonceKey: 2.9,
      }),
    ).resolves.toBe('0x1f');

    expect(mockEncodeFunctionData).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'getNonce',
        args: ['0xabc', 2n],
      }),
    );
    expect(mockRequestReadOnlyETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_call',
        params: [
          {
            to: '0x0000000000000000000000000000000000001000',
            data: '0xencodedNonceCall',
          },
          'latest',
        ],
      },
      'tempo',
      null,
    );
    expect(mockDecodeFunctionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'getNonce',
        data: '0xencodedNonceResult',
      }),
    );
    expect(mockGetNonceByChain).not.toHaveBeenCalled();
  });
});
