describe('core/apis/balance', () => {
  let getAddressBalance: typeof import('./balance').getAddressBalance;
  let getAddressCacheBalanceSync: typeof import('./balance').getAddressCacheBalanceSync;
  let computeBalanceChange: typeof import('./balance').computeBalanceChange;
  let mockKeyringService: {
    getAllAddresses: jest.Mock;
  };
  let mockGetTokenSettings: jest.Mock;
  let mockBatchBalanceWithLocalCache: jest.Mock;
  let mockIsSameAddress: jest.Mock;
  let mockTestnetGetTotalBalanceV2: jest.Mock;
  let mockGetTestnetAddressBalanceCache: jest.Mock;
  let mockSetTestnetAddressBalanceCache: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    mockKeyringService = {
      getAllAddresses: jest.fn(),
    };
    mockGetTokenSettings = jest.fn();
    mockBatchBalanceWithLocalCache = jest.fn();
    mockIsSameAddress = jest.fn();
    mockTestnetGetTotalBalanceV2 = jest.fn();
    mockGetTestnetAddressBalanceCache = jest.fn();
    mockSetTestnetAddressBalanceCache = jest.fn();

    jest.doMock('@/utils/cache', () => ({
      cached:
        (fn: (...args: unknown[]) => unknown) =>
        (args: unknown[], _key: string, _force: boolean) =>
          fn(...args),
    }));
    jest.doMock('../services', () => ({
      keyringService: mockKeyringService,
    }));
    jest.doMock('../request', () => ({
      testOpenapi: {
        getTotalBalanceV2: mockTestnetGetTotalBalanceV2,
      },
    }));
    jest.doMock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
      isSameAddress: mockIsSameAddress,
    }));
    jest.doMock('@rabby-wallet/keyring-utils', () => ({
      CORE_KEYRING_TYPES: [],
    }));
    jest.doMock('@/utils/getTokenSettings', () => ({
      getTokenSettings: mockGetTokenSettings,
    }));
    jest.doMock('@/databases/hooks/balance', () => ({
      batchBalanceWithLocalCache: mockBatchBalanceWithLocalCache,
    }));
    jest.doMock('@/store/balance', () => ({
      __esModule: true,
      default: {
        getAddressValue: jest.fn(() => undefined),
        getAddressChainList: jest.fn(() => []),
      },
    }));
    jest.doMock('@/utils/testnetAddressBalanceCache', () => ({
      getTestnetAddressBalanceCache: (...args: unknown[]) =>
        mockGetTestnetAddressBalanceCache(...args),
      setTestnetAddressBalanceCache: (...args: unknown[]) =>
        mockSetTestnetAddressBalanceCache(...args),
    }));

    ({
      getAddressBalance,
      getAddressCacheBalanceSync,
      computeBalanceChange,
    } = require('./balance'));
  });

  describe('computeBalanceChange', () => {
    it('returns both the absolute change and percent when base value is non-zero', () => {
      expect(computeBalanceChange(150, 100)).toEqual({
        assetsChange: 50,
        changePercent: '50.00%',
      });
    });

    it('returns 0% when both realtime and base values are zero', () => {
      expect(computeBalanceChange(0, 0)).toEqual({
        assetsChange: 0,
        changePercent: '0%',
      });
    });

    it('returns 100% whenever base value is zero and realtime value is non-zero', () => {
      expect(computeBalanceChange(1, 0)).toEqual({
        assetsChange: 1,
        changePercent: '100.00%',
      });

      expect(computeBalanceChange(-1, 0)).toEqual({
        assetsChange: -1,
        changePercent: '100.00%',
      });
    });
  });

  describe('getAddressBalance', () => {
    it('delegates mainnet address refresh to balanceStore path without writing preference cache again', async () => {
      mockKeyringService.getAllAddresses.mockResolvedValue([
        {
          address: '0xabc',
          type: 'WatchAddressKeyring',
        },
      ]);
      mockIsSameAddress.mockReturnValue(true);
      mockGetTokenSettings.mockResolvedValue({
        included_token_uuids: [],
        excluded_token_uuids: [],
        excluded_protocol_ids: [],
        excluded_chain_ids: [],
      });
      mockBatchBalanceWithLocalCache.mockResolvedValue({
        total_usd_value: 123,
        evm_usd_value: 120,
        chain_list: [],
      });

      const result = await getAddressBalance('0xABC', {
        force: true,
        isTestnet: false,
      });

      expect(result).toEqual({
        total_usd_value: 123,
        evm_usd_value: 120,
        chain_list: [],
      });
      expect(mockBatchBalanceWithLocalCache).toHaveBeenCalledWith(
        {
          address: '0xABC',
          isCore: false,
          included_token_uuids: [],
          excluded_token_uuids: [],
          excluded_protocol_ids: [],
          excluded_chain_ids: [],
        },
        true,
      );
    });

    it('persists testnet balance into dedicated cache storage', async () => {
      mockGetTokenSettings.mockResolvedValue({
        included_token_uuids: [],
        excluded_token_uuids: [],
        excluded_protocol_ids: [],
        excluded_chain_ids: [],
      });
      mockTestnetGetTotalBalanceV2.mockResolvedValue({
        total_usd_value: 88,
        chain_list: [],
      });

      const result = await getAddressBalance('0xABC', {
        force: true,
        isTestnet: true,
      });

      expect(result).toEqual({
        total_usd_value: 88,
        evm_usd_value: 88,
        chain_list: [],
      });
      expect(mockSetTestnetAddressBalanceCache).toHaveBeenCalledWith('0xABC', {
        total_usd_value: 88,
        evm_usd_value: 88,
        chain_list: [],
      });
    });

    it('reads testnet cached balance from dedicated cache storage', () => {
      mockGetTestnetAddressBalanceCache.mockReturnValue({
        total_usd_value: 99,
        evm_usd_value: 77,
        chain_list: [],
      });

      expect(getAddressCacheBalanceSync('0xabc', true)).toEqual({
        total_usd_value: 99,
        evm_usd_value: 77,
        chain_list: [],
      });
      expect(mockGetTestnetAddressBalanceCache).toHaveBeenCalledWith('0xabc');
    });
  });
});
