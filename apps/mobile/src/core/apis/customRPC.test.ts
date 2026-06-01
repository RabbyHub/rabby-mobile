function loadCustomRPCModule() {
  jest.resetModules();

  const mockFindChain = jest.fn();
  const mockPing = jest.fn();
  const mockRequest = jest.fn();

  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));
  jest.doMock('../services/shared', () => ({
    customRPCService: {
      getAllRPC: jest.fn(),
      getRPCByChain: jest.fn(),
      hasCustomRPC: jest.fn(),
      ping: mockPing,
      removeCustomRPC: jest.fn(),
      request: mockRequest,
      setRPC: jest.fn(),
      setRPCEnable: jest.fn(),
    },
  }));

  const { apiCustomRPC } =
    require('./customRPC') as typeof import('./customRPC');

  return {
    apiCustomRPC,
    mocks: {
      mockFindChain,
      mockPing,
      mockRequest,
    },
  };
}

describe('core/apis/customRPC', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('rejects RPC validation for unsupported chain ids before making network calls', async () => {
    const { apiCustomRPC, mocks } = loadCustomRPCModule();
    mocks.mockFindChain.mockReturnValue(null);

    await expect(
      apiCustomRPC.validateRPC('https://rpc.example', 12345),
    ).rejects.toThrow('ChainId 12345 is not supported');

    expect(mocks.mockPing).not.toHaveBeenCalled();
    expect(mocks.mockRequest).not.toHaveBeenCalled();
  });

  it('pings the built-in chain and validates the candidate RPC eth_chainId', async () => {
    const { apiCustomRPC, mocks } = loadCustomRPCModule();
    mocks.mockFindChain.mockReturnValue({
      enum: 'eth',
      id: 1,
    });
    mocks.mockPing.mockResolvedValue(undefined);
    mocks.mockRequest.mockResolvedValue('0x1');

    await expect(
      apiCustomRPC.validateRPC('https://rpc.example', 1),
    ).resolves.toBe(true);

    expect(mocks.mockPing).toHaveBeenCalledWith('eth');
    expect(mocks.mockRequest).toHaveBeenCalledWith(
      'https://rpc.example',
      'eth_chainId',
      [],
    );
  });

  it('returns false when the candidate RPC reports a different chain id', async () => {
    const { apiCustomRPC, mocks } = loadCustomRPCModule();
    mocks.mockFindChain.mockReturnValue({
      enum: 'eth',
      id: 1,
    });
    mocks.mockPing.mockResolvedValue(undefined);
    mocks.mockRequest.mockResolvedValue('0x2');

    await expect(
      apiCustomRPC.validateRPC('https://rpc.example', 1),
    ).resolves.toBe(false);
  });
});
