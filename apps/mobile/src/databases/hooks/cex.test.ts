import type { Cex, ProjectItem } from '@rabby-wallet/rabby-api/dist/types';

const mockAddrDesc = jest.fn();
const mockIsExpired = jest.fn();
const mockQueryCexInfo = jest.fn();
const mockSyncCexInfo = jest.fn();
const mockGetCexId = jest.fn();
const mockWaitForCexSupportListReady = jest.fn();
const mockSupportCexList: ProjectItem[] = [];

jest.mock('@/core/request', () => ({
  openapi: {
    addrDesc: (...args: unknown[]) => mockAddrDesc(...args),
  },
}));

jest.mock('../entities/cex', () => ({
  CexEntity: {
    isExpired: (...args: unknown[]) => mockIsExpired(...args),
    queryCexInfo: (...args: unknown[]) => mockQueryCexInfo(...args),
  },
}));

jest.mock('../sync/assets', () => ({
  syncCexInfo: (...args: unknown[]) => mockSyncCexInfo(...args),
}));

jest.mock('@/utils/addressCexId', () => ({
  getCexId: (...args: unknown[]) => mockGetCexId(...args),
}));

jest.mock('@/hooks/useCexSupportList', () => ({
  globalSupportCexList: mockSupportCexList,
  waitForCexSupportListReady: () => mockWaitForCexSupportListReady(),
}));

jest.mock('react-native-reanimated', () => ({
  runOnJS: jest.fn(),
}));

import { getAddrDescWithCexLocalCacheSync, getCexWithLocalCache } from './cex';

const address = '0x0000000000000000000000000000000000000001';
const bitget: ProjectItem = {
  id: 'bitget',
  name: 'Bitget',
  logo_url: 'https://example.com/bitget.png',
  site_url: 'https://www.bitget.com',
};
const canonicalBitget: Cex = {
  id: bitget.id,
  name: bitget.name,
  logo_url: bitget.logo_url,
  is_deposit: true,
};
const unsupportedCex: Cex = {
  id: 'crypto',
  name: 'Crypto.com',
  logo_url: 'https://example.com/crypto.png',
  is_deposit: true,
};

const makeAddressDescResponse = (cex?: Cex) => ({
  desc: {
    cex,
    usd_value: 0,
    born_at: 0,
    is_danger: false,
    is_spam: false,
    is_scam: false,
    name: '',
    id: address,
  },
});

describe('cex database hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupportCexList.splice(0, mockSupportCexList.length, bitget);
    mockWaitForCexSupportListReady.mockResolvedValue(mockSupportCexList);
    mockIsExpired.mockResolvedValue(true);
    mockGetCexId.mockReturnValue(undefined);
  });

  describe('getCexWithLocalCache', () => {
    it('caches raw backend CEX but hides an unsupported CEX from consumers', async () => {
      mockAddrDesc.mockResolvedValue(makeAddressDescResponse(unsupportedCex));

      await expect(getCexWithLocalCache(address)).resolves.toBeUndefined();
      expect(mockSyncCexInfo).toHaveBeenCalledWith(address, unsupportedCex);
    });

    it('returns canonical supported-list metadata for a supported deposit CEX', async () => {
      mockAddrDesc.mockResolvedValue(
        makeAddressDescResponse({
          ...canonicalBitget,
          id: 'BITGET',
          name: 'stale name',
          logo_url: 'https://example.com/stale.png',
        }),
      );

      await expect(getCexWithLocalCache(address)).resolves.toEqual(
        canonicalBitget,
      );
    });

    it('lets a supported local mark override an unsupported backend CEX', async () => {
      mockGetCexId.mockReturnValue('BITGET');
      mockAddrDesc.mockResolvedValue(makeAddressDescResponse(unsupportedCex));

      await expect(getCexWithLocalCache(address)).resolves.toEqual(
        canonicalBitget,
      );
    });
  });

  describe('getAddrDescWithCexLocalCacheSync', () => {
    it('preserves unsupported backend CEX data for risk evaluation', async () => {
      const response = makeAddressDescResponse(unsupportedCex);
      mockAddrDesc.mockResolvedValue(response);

      const result = await getAddrDescWithCexLocalCacheSync(address);

      expect(result?.cex).toBe(unsupportedCex);
      expect(mockSyncCexInfo).toHaveBeenCalledWith(address, unsupportedCex);
      expect(mockWaitForCexSupportListReady).not.toHaveBeenCalled();
    });

    it('preserves non-deposit backend CEX data for CEX_NO_DEPOSIT risk', async () => {
      const nonDepositCex = { ...unsupportedCex, is_deposit: false };
      mockAddrDesc.mockResolvedValue(makeAddressDescResponse(nonDepositCex));

      const result = await getAddrDescWithCexLocalCacheSync(address);

      expect(result?.cex).toBe(nonDepositCex);
      expect(result?.cex?.is_deposit).toBe(false);
    });

    it('ignores an unsupported local mark instead of replacing backend data', async () => {
      mockGetCexId.mockReturnValue('crypto');
      mockAddrDesc.mockResolvedValue(makeAddressDescResponse(unsupportedCex));

      const result = await getAddrDescWithCexLocalCacheSync(address);

      expect(result?.cex).toBe(unsupportedCex);
    });

    it('overlays canonical metadata only for a supported local mark', async () => {
      mockGetCexId.mockReturnValue('BITGET');
      mockAddrDesc.mockResolvedValue(makeAddressDescResponse(unsupportedCex));

      const result = await getAddrDescWithCexLocalCacheSync(address);

      expect(result?.cex).toEqual(canonicalBitget);
    });
  });
});
