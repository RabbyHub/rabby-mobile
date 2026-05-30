const mockFindChain = jest.fn();
const mockCustomRPCService = {
  setRPC: jest.fn(),
  removeCustomRPC: jest.fn(),
  getAllRPC: jest.fn(),
  getRPCByChain: jest.fn(),
  ping: jest.fn(),
  setRPCEnable: jest.fn(),
  request: jest.fn(),
  hasCustomRPC: jest.fn(),
};

const loadCustomRPCModule = () => {
  jest.resetModules();

  jest.doMock('../services/shared', () => ({
    customRPCService: mockCustomRPCService,
  }));

  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));

  return require('./customRPC') as typeof import('./customRPC');
};

describe('apiCustomRPC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindChain.mockReturnValue({
      id: 1,
      enum: 'ETH',
    });
    mockCustomRPCService.ping.mockResolvedValue(true);
    mockCustomRPCService.request.mockResolvedValue('0x1');
  });

  it('rejects validation for unsupported chain ids before touching the RPC url', async () => {
    const { apiCustomRPC } = loadCustomRPCModule();
    mockFindChain.mockReturnValue(undefined);

    await expect(
      apiCustomRPC.validateRPC('https://rpc.example', 999_999),
    ).rejects.toThrow('ChainId 999999 is not supported');

    expect(mockCustomRPCService.ping).not.toHaveBeenCalled();
    expect(mockCustomRPCService.request).not.toHaveBeenCalled();
  });

  it('validates RPC endpoints by pinging the chain and comparing eth_chainId', async () => {
    const { apiCustomRPC } = loadCustomRPCModule();

    await expect(
      apiCustomRPC.validateRPC('https://rpc.example', 1),
    ).resolves.toBe(true);

    expect(mockCustomRPCService.ping).toHaveBeenCalledWith('ETH');
    expect(mockCustomRPCService.request).toHaveBeenCalledWith(
      'https://rpc.example',
      'eth_chainId',
      [],
    );

    mockCustomRPCService.request.mockResolvedValue('0x38');
    await expect(
      apiCustomRPC.validateRPC('https://rpc.example', 1),
    ).resolves.toBe(false);
  });
});
