function loadRecommendNonceModule() {
  jest.resetModules();

  const mockDecodeFunctionResult = jest.fn();
  const mockEncodeFunctionData = jest.fn();
  const mockFindChain = jest.fn();
  const mockGetNonceByChain = jest.fn();
  const mockIsTempoChain = jest.fn();
  const mockRequestReadOnlyETHRpc = jest.fn();

  jest.doMock('i18next', () => ({
    t: (key: string) => key,
  }));
  jest.doMock('viem', () => ({
    decodeFunctionResult: (...args: unknown[]) =>
      mockDecodeFunctionResult(...args),
    encodeFunctionData: (...args: unknown[]) => mockEncodeFunctionData(...args),
  }));
  jest.doMock('viem/tempo', () => ({
    Abis: {
      nonce: ['nonce-abi'],
    },
    Addresses: {
      nonceManager: '0xnonce',
    },
  }));
  jest.doMock('@/core/services', () => ({
    transactionHistoryService: {
      getNonceByChain: (...args: unknown[]) => mockGetNonceByChain(...args),
    },
  }));
  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));
  jest.doMock('@/utils/tempoChain', () => ({
    isTempoChain: (...args: unknown[]) => mockIsTempoChain(...args),
  }));
  jest.doMock('./readOnlyRpc', () => ({
    requestReadOnlyETHRpc: (...args: unknown[]) =>
      mockRequestReadOnlyETHRpc(...args),
  }));

  const { getRecommendNonce } =
    require('./recommendNonce') as typeof import('./recommendNonce');

  return {
    getRecommendNonce,
    mocks: {
      mockDecodeFunctionResult,
      mockEncodeFunctionData,
      mockFindChain,
      mockGetNonceByChain,
      mockIsTempoChain,
      mockRequestReadOnlyETHRpc,
    },
  };
}

describe('core/apis/recommendNonce', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('rejects unsupported chain ids before reading local or remote nonce', async () => {
    const { getRecommendNonce, mocks } = loadRecommendNonceModule();
    mocks.mockFindChain.mockReturnValue(null);

    await expect(
      getRecommendNonce({
        account: null,
        chainId: 12345,
        from: '0xabc',
      }),
    ).rejects.toThrow('background.error.invalidChainId');

    expect(mocks.mockRequestReadOnlyETHRpc).not.toHaveBeenCalled();
    expect(mocks.mockGetNonceByChain).not.toHaveBeenCalled();
  });

  it('uses the larger value between standard on-chain and local transaction-history nonce', async () => {
    const { getRecommendNonce, mocks } = loadRecommendNonceModule();
    const account = {
      address: '0xabc',
    };
    mocks.mockFindChain.mockReturnValue({
      id: 1,
      serverId: 'eth',
    });
    mocks.mockIsTempoChain.mockReturnValue(false);
    mocks.mockRequestReadOnlyETHRpc.mockResolvedValue('0x5');
    mocks.mockGetNonceByChain.mockResolvedValue(7);

    await expect(
      getRecommendNonce({
        account: account as never,
        chainId: 1,
        from: '0xabc',
      }),
    ).resolves.toBe('0x7');

    expect(mocks.mockRequestReadOnlyETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_getTransactionCount',
        params: ['0xabc', 'latest'],
      },
      'eth',
      account,
    );
    expect(mocks.mockGetNonceByChain).toHaveBeenCalledWith('0xabc', 1);
  });

  it('reads Tempo keyed nonce with eth_call when a positive nonce key is provided', async () => {
    const { getRecommendNonce, mocks } = loadRecommendNonceModule();
    const account = {
      address: '0xabc',
    };
    mocks.mockFindChain.mockReturnValue({
      id: 999,
      serverId: 'tempo',
    });
    mocks.mockIsTempoChain.mockReturnValue(true);
    mocks.mockEncodeFunctionData.mockReturnValue('0xencoded');
    mocks.mockRequestReadOnlyETHRpc.mockResolvedValue('0xresult');
    mocks.mockDecodeFunctionResult.mockReturnValue(10n);

    await expect(
      getRecommendNonce({
        account: account as never,
        chainId: 999,
        from: '0xabc',
        nonceKey: ' 0x2 ',
      }),
    ).resolves.toBe('0xa');

    expect(mocks.mockEncodeFunctionData).toHaveBeenCalledWith({
      abi: ['nonce-abi'],
      args: ['0xabc', 2n],
      functionName: 'getNonce',
    });
    expect(mocks.mockRequestReadOnlyETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_call',
        params: [
          {
            data: '0xencoded',
            to: '0xnonce',
          },
          'latest',
        ],
      },
      'tempo',
      account,
    );
    expect(mocks.mockDecodeFunctionResult).toHaveBeenCalledWith({
      abi: ['nonce-abi'],
      data: '0xresult',
      functionName: 'getNonce',
    });
    expect(mocks.mockGetNonceByChain).not.toHaveBeenCalled();
  });

  it('falls back to the standard nonce path for Tempo chains when the nonce key is empty or non-positive', async () => {
    const { getRecommendNonce, mocks } = loadRecommendNonceModule();
    mocks.mockFindChain.mockReturnValue({
      id: 999,
      serverId: 'tempo',
    });
    mocks.mockIsTempoChain.mockReturnValue(true);
    mocks.mockRequestReadOnlyETHRpc.mockResolvedValue('0x8');
    mocks.mockGetNonceByChain.mockResolvedValue(3);

    await expect(
      getRecommendNonce({
        account: null,
        chainId: 999,
        from: '0xabc',
        nonceKey: 0n,
      }),
    ).resolves.toBe('0x8');

    expect(mocks.mockEncodeFunctionData).not.toHaveBeenCalled();
    expect(mocks.mockRequestReadOnlyETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_getTransactionCount',
        params: ['0xabc', 'latest'],
      },
      'tempo',
      null,
    );
    expect(mocks.mockGetNonceByChain).toHaveBeenCalledWith('0xabc', 999);
  });
});
