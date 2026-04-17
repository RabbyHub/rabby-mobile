const mockStore = new Map<string, string>();

const mockMMKVInstance = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
  }),
  delete: jest.fn((key: string) => {
    mockStore.delete(key);
  }),
};

function loadModule() {
  jest.resetModules();

  jest.doMock('react-native-mmkv', () => ({
    MMKV: jest.fn(() => mockMMKVInstance),
  }));

  jest.doMock('@/core/utils/appFS', () => ({
    MMKV_FILE_NAMES: {
      TESTNET_BALANCE: 'testnet-balance',
    },
  }));

  return require('./testnetAddressBalanceCache') as typeof import('./testnetAddressBalanceCache');
}

describe('utils/testnetAddressBalanceCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
  });

  it('stores and reads balances with lowercased address keys', () => {
    const balanceCache = loadModule();

    balanceCache.setTestnetAddressBalanceCache('0xABCD', {
      total_usd_value: 12,
      evm_usd_value: 10,
      chain_list: [],
    });

    expect(balanceCache.getTestnetAddressBalanceCache('0xabcd')).toEqual({
      total_usd_value: 12,
      evm_usd_value: 10,
      chain_list: [],
    });
    expect(mockMMKVInstance.set).toHaveBeenCalledWith(
      '0xabcd',
      JSON.stringify({
        total_usd_value: 12,
        evm_usd_value: 10,
        chain_list: [],
      }),
    );
  });

  it('returns null for empty cache and removes by lowercased address', () => {
    const balanceCache = loadModule();

    expect(balanceCache.getTestnetAddressBalanceCache('0xnone')).toBeNull();

    balanceCache.removeTestnetAddressBalanceCache('0xABCD');

    expect(mockMMKVInstance.delete).toHaveBeenCalledWith('0xabcd');
  });
});
