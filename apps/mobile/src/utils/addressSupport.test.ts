const mockDepositCexSupport = jest.fn();
const mockGetAddrDescWithCexLocalCacheSync = jest.fn();
const mockGetCexWithLocalCache = jest.fn();
const mockGetCexIds = jest.fn();
const mockGetTokenWithMaxUsdValue = jest.fn();
const mockFindChainByEnum = jest.fn();
const mockFindChainByServerID = jest.fn();

jest.mock('@/core/request', () => ({
  openapi: {
    depositCexSupport: (...args: unknown[]) => mockDepositCexSupport(...args),
  },
}));

jest.mock('@/databases/hooks/cex', () => ({
  getAddrDescWithCexLocalCacheSync: (...args: unknown[]) =>
    mockGetAddrDescWithCexLocalCacheSync(...args),
  getCexWithLocalCache: (...args: unknown[]) =>
    mockGetCexWithLocalCache(...args),
}));

jest.mock('@/databases/entities/tokenitem', () => ({
  TokenItemEntity: {
    getCexIds: (...args: unknown[]) => mockGetCexIds(...args),
    getTokenWithMaxUsdValue: (...args: unknown[]) =>
      mockGetTokenWithMaxUsdValue(...args),
  },
}));

jest.mock('./chain', () => ({
  findChainByEnum: (...args: unknown[]) => mockFindChainByEnum(...args),
  findChainByServerID: (...args: unknown[]) => mockFindChainByServerID(...args),
}));

jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: {
    ETH: 'ETH',
  },
}));

import {
  getContractRecommendToken,
  getDefaultToken,
  getRecommendToken,
  isAddrsssContractSupportToken,
  isCexAddressSupportToken,
} from './addressSupport';

describe('addressSupport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindChainByEnum.mockReturnValue({
      serverId: 'eth',
      nativeTokenAddress: 'eth',
    });
  });

  it('builds the default token from the ETH chain metadata', () => {
    expect(getDefaultToken()).toEqual({
      chain: 'eth',
      tokenId: 'eth',
    });
  });

  it('treats non-cex addresses as supported without querying token support', async () => {
    mockGetCexWithLocalCache.mockResolvedValue(null);

    await expect(
      isCexAddressSupportToken('0xaddr', 'eth', 'token-1'),
    ).resolves.toEqual({
      isCex: false,
      isSupport: true,
    });

    expect(mockGetCexIds).not.toHaveBeenCalled();
    expect(mockDepositCexSupport).not.toHaveBeenCalled();
  });

  it('prefers locally cached cex support info and compares ids case-insensitively', async () => {
    mockGetCexWithLocalCache.mockResolvedValue({ id: 'biNanCe' });
    mockGetCexIds.mockResolvedValue({
      find: true,
      cex_ids: ['BINANCE', 'OKX'],
    });

    await expect(
      isCexAddressSupportToken('0xaddr', 'eth', 'token-1'),
    ).resolves.toEqual({
      isCex: true,
      isSupport: true,
    });

    expect(mockDepositCexSupport).not.toHaveBeenCalled();
  });

  it('falls back to the backend cex support check when the local cache misses', async () => {
    mockGetCexWithLocalCache.mockResolvedValue({ id: 'okx' });
    mockGetCexIds.mockResolvedValue({
      find: false,
      cex_ids: [],
    });
    mockDepositCexSupport.mockResolvedValue({
      support: false,
    });

    await expect(
      isCexAddressSupportToken('0xaddr', 'eth', 'token-1'),
    ).resolves.toEqual({
      isCex: true,
      isSupport: false,
    });

    expect(mockDepositCexSupport).toHaveBeenCalledWith('token-1', 'eth', 'okx');
  });

  it('reads contract support chains from address descriptions', async () => {
    mockGetAddrDescWithCexLocalCacheSync.mockResolvedValue({
      contract: {
        eth: {},
        base: {},
      },
    });

    await expect(
      isAddrsssContractSupportToken('0xaddr', 'arb'),
    ).resolves.toEqual([false, ['eth', 'base']]);
  });

  it('picks the max-usd contract token when one exists', async () => {
    mockFindChainByServerID
      .mockReturnValueOnce({ nativeTokenAddress: 'eth' })
      .mockReturnValueOnce({ nativeTokenAddress: 'base' });
    mockGetTokenWithMaxUsdValue.mockResolvedValue({
      chain: 'base',
      id: 'base-native',
    });

    await expect(
      getContractRecommendToken('0xfrom', ['eth', 'base']),
    ).resolves.toEqual({
      chain: 'base',
      tokenId: 'base-native',
    });
  });

  it('falls back to the first supported contract chain when max-usd lookup misses', async () => {
    mockFindChainByServerID.mockReturnValue({ nativeTokenAddress: 'eth' });
    mockGetTokenWithMaxUsdValue.mockResolvedValue(null);

    await expect(getContractRecommendToken('0xfrom', ['eth'])).resolves.toEqual(
      {
        chain: 'eth',
        tokenId: 'eth',
      },
    );
  });

  it('returns the pass token for supported targets and the default token for unsupported cex targets', async () => {
    mockGetCexWithLocalCache.mockResolvedValue({ id: 'okx' });
    mockGetCexIds.mockResolvedValue({
      find: true,
      cex_ids: ['okx'],
    });

    await expect(
      getRecommendToken({
        from: '0xfrom',
        to: '0xto',
        tokenId: 'token-1',
        chain: 'eth',
      }),
    ).resolves.toEqual({
      chain: 'eth',
      tokenId: 'token-1',
    });

    mockGetCexIds.mockResolvedValue({
      find: true,
      cex_ids: ['binance'],
    });

    await expect(
      getRecommendToken({
        from: '0xfrom',
        to: '0xto',
        tokenId: 'token-1',
        chain: 'eth',
      }),
    ).resolves.toEqual({
      chain: 'eth',
      tokenId: 'eth',
    });
  });
});
