const mockGetEnsAddress = jest.fn();
const mockGetEnsName = jest.fn();
const mockCreatePublicClient = jest.fn();
const mockCustom = jest.fn();
const mockRequestETHRpc = jest.fn();

const loadSubject = () => {
  jest.resetModules();
  jest.doMock('viem', () => {
    const actual = jest.requireActual('viem');
    return {
      ...actual,
      createPublicClient: (...args: unknown[]) => {
        mockCreatePublicClient(...args);
        return {
          getEnsAddress: (...clientArgs: unknown[]) =>
            mockGetEnsAddress(...clientArgs),
          getEnsName: (...clientArgs: unknown[]) =>
            mockGetEnsName(...clientArgs),
        };
      },
      custom: (transport: unknown) => {
        mockCustom(transport);
        return transport;
      },
    };
  });
  jest.doMock('viem/chains', () => ({
    mainnet: {
      id: 1,
      name: 'Ethereum',
    },
  }));
  jest.doMock('@/core/apis/provider', () => ({
    requestETHRpc: (...args: unknown[]) => mockRequestETHRpc(...args),
  }));
  jest.doMock('@/utils/chain', () => ({
    findChain: () => ({ serverId: 'eth' }),
  }));
  return require('./ens') as typeof import('./ens');
};

describe('ens utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnsAddress.mockReset();
    mockGetEnsName.mockReset();
  });

  afterEach(() => {
    jest.dontMock('viem');
    jest.dontMock('viem/chains');
    jest.dontMock('@/core/apis/provider');
    jest.dontMock('@/utils/chain');
    jest.resetModules();
  });

  it('creates an ENS client backed by Rabby ETH RPC transport', async () => {
    loadSubject();

    expect(mockCreatePublicClient).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: expect.objectContaining({ id: 1 }),
      }),
    );

    const transportArg = mockCustom.mock.calls[0][0];
    mockRequestETHRpc.mockResolvedValue('0x1');

    await expect(
      transportArg.request({
        method: 'eth_chainId',
        params: [],
      }),
    ).resolves.toBe('0x1');

    expect(mockRequestETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_chainId',
        params: [],
      },
      'eth',
    );
  });

  it('normalizes and resolves ENS names', async () => {
    const { resolveEnsAddressByName } = loadSubject();
    mockGetEnsAddress.mockResolvedValue(
      '0x1111111111111111111111111111111111111111',
    );

    await expect(resolveEnsAddressByName('  Vitalik.eth  ')).resolves.toEqual({
      addr: '0x1111111111111111111111111111111111111111',
      name: 'vitalik.eth',
    });

    expect(mockGetEnsAddress).toHaveBeenCalledWith({ name: 'vitalik.eth' });
  });

  it('returns null for empty, unresolved, or invalid ENS names', async () => {
    const { resolveEnsAddressByName } = loadSubject();

    await expect(resolveEnsAddressByName('   ')).resolves.toBeNull();

    mockGetEnsAddress.mockResolvedValueOnce(null);
    await expect(resolveEnsAddressByName('missing.eth')).resolves.toBeNull();

    await expect(
      resolveEnsAddressByName('not a valid ens'),
    ).resolves.toBeNull();
  });

  it('resolves reverse ENS names and handles empty or failing lookups', async () => {
    const { resolveEnsNameByAddress } = loadSubject();
    mockGetEnsName.mockResolvedValueOnce('vitalik.eth');

    await expect(
      resolveEnsNameByAddress(' 0x1111111111111111111111111111111111111111 '),
    ).resolves.toBe('vitalik.eth');
    expect(mockGetEnsName).toHaveBeenCalledWith({
      address: '0x1111111111111111111111111111111111111111',
    });

    await expect(resolveEnsNameByAddress('   ')).resolves.toBeNull();

    mockGetEnsName.mockRejectedValueOnce(new Error('rpc'));
    await expect(
      resolveEnsNameByAddress('0x2222222222222222222222222222222222222222'),
    ).resolves.toBeNull();
  });
});
