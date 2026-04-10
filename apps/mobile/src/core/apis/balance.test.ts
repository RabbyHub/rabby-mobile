describe('core/apis/balance', () => {
  let computeBalanceChange: typeof import('./balance').computeBalanceChange;

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('@/utils/cache', () => ({
      cached: (fn: unknown) => fn,
    }));
    jest.doMock('../services', () => ({
      preferenceService: {
        updateAddressBalance: jest.fn(),
        updateTestnetAddressBalance: jest.fn(),
        getTestnetAddressBalance: jest.fn(),
      },
      keyringService: {
        getAllAddresses: jest.fn(),
      },
    }));
    jest.doMock('../request', () => ({
      testOpenapi: {
        getTotalBalanceV2: jest.fn(),
      },
    }));
    jest.doMock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
      isSameAddress: jest.fn(),
    }));
    jest.doMock('@rabby-wallet/keyring-utils', () => ({
      CORE_KEYRING_TYPES: [],
    }));
    jest.doMock('@/utils/getTokenSettings', () => ({
      getTokenSettings: jest.fn(),
    }));
    jest.doMock('@/databases/hooks/balance', () => ({
      batchBalanceWithLocalCache: jest.fn(),
    }));
    jest.doMock('@/store/balance', () => ({
      __esModule: true,
      default: {
        getState: jest.fn(() => ({
          balanceMap: {},
          chainUSDMap: {},
        })),
      },
    }));

    ({ computeBalanceChange } = require('./balance'));
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
});
