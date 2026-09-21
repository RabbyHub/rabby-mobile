const mockStorage = {
  getString: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

function loadAddressCexIdModule() {
  jest.resetModules();

  jest.doMock('react-native-mmkv', () => ({
    MMKV: jest.fn(() => mockStorage),
  }));

  jest.doMock('@/core/utils/appFS', () => ({
    MMKV_FILE_NAMES: {
      CEXID: 'CEXID',
    },
  }));

  return require('./addressCexId') as typeof import('./addressCexId');
}

describe('addressCexId utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets values with a lowercased address key', () => {
    mockStorage.getString.mockReturnValue('binance');
    const { getCexId } = loadAddressCexIdModule();

    expect(getCexId('0xABCD')).toBe('binance');
    expect(mockStorage.getString).toHaveBeenCalledWith('0xabcd');
  });

  it('stores values only when cexId is truthy', () => {
    const { setCexId } = loadAddressCexIdModule();

    setCexId('0xABCD', 'coinbase');
    setCexId('0xABCD', '');

    expect(mockStorage.set).toHaveBeenCalledTimes(1);
    expect(mockStorage.set).toHaveBeenCalledWith('0xabcd', 'coinbase');
  });

  it('removes values using a lowercased address key', () => {
    const { removeCexId } = loadAddressCexIdModule();

    removeCexId('0xABCD');

    expect(mockStorage.delete).toHaveBeenCalledWith('0xabcd');
  });
});
