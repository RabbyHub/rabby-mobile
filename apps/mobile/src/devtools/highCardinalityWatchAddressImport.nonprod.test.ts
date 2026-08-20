const FIRST_ADDRESS = '0x0000000000000000000000000000000000000001';
const SECOND_ADDRESS = '0x0000000000000000000000000000000000000002';
const THIRD_ADDRESS = '0x0000000000000000000000000000000000000003';

function loadImportModule({ isNonProduction = true } = {}) {
  jest.resetModules();
  const addWatchAddress = jest.fn();
  const fetchAccounts = jest.fn();
  const getHomeAssetSelectionSettings = jest.fn(() => ({
    topN: 20,
    includeWatchAddresses: true,
  }));
  const setHomeAssetTopN = jest.fn();
  const setIncludeWatchAddressesInHomeAssetSelection = jest.fn();

  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv: isNonProduction,
  }));
  jest.doMock('@/constant/homeAssetSelection', () => ({
    DEFAULT_HOME_ASSET_TOP_N: 10,
  }));
  jest.doMock('@/core/apis/address', () => ({ addWatchAddress }));
  jest.doMock('@/hooks/appSettings', () => ({
    getHomeAssetSelectionSettings,
    setHomeAssetTopN,
    setIncludeWatchAddressesInHomeAssetSelection,
  }));
  jest.doMock('@/store/account', () => ({
    __esModule: true,
    default: { fetchAccounts },
  }));

  return {
    module:
      require('./highCardinalityWatchAddressImport.nonprod') as typeof import('./highCardinalityWatchAddressImport.nonprod'),
    mocks: {
      addWatchAddress,
      fetchAccounts,
      setHomeAssetTopN,
      setIncludeWatchAddressesInHomeAssetSelection,
    },
  };
}

describe('high-cardinality Watch-address import', () => {
  it('imports missing addresses once and restores the selected policy', async () => {
    const { module, mocks } = loadImportModule();
    mocks.fetchAccounts
      .mockResolvedValueOnce([{ address: FIRST_ADDRESS }])
      .mockResolvedValueOnce([
        { address: FIRST_ADDRESS },
        { address: SECOND_ADDRESS },
        { address: THIRD_ADDRESS },
      ]);
    const onProgress = jest.fn();

    const result = await module.importHighCardinalityWatchAddresses(
      [FIRST_ADDRESS, SECOND_ADDRESS, THIRD_ADDRESS],
      { onProgress },
    );

    expect(mocks.addWatchAddress.mock.calls).toEqual([
      [SECOND_ADDRESS],
      [THIRD_ADDRESS],
    ]);
    expect(result).toMatchObject({
      fixtureAddressCount: 3,
      existingCount: 1,
      importedCount: 2,
      failedCount: 0,
      missingCount: 0,
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      completedCount: 3,
      totalCount: 3,
    });
    expect(mocks.setHomeAssetTopN.mock.calls).toEqual([[10], [20]]);
    expect(
      mocks.setIncludeWatchAddressesInHomeAssetSelection.mock.calls,
    ).toEqual([[false], [true]]);
  });

  it('reports partial failures without losing policy restoration', async () => {
    const { module, mocks } = loadImportModule();
    mocks.fetchAccounts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ address: FIRST_ADDRESS }]);
    mocks.addWatchAddress
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fixture import failed'));

    const result = await module.importHighCardinalityWatchAddresses([
      FIRST_ADDRESS,
      SECOND_ADDRESS,
    ]);

    expect(result).toMatchObject({
      fixtureAddressCount: 1,
      existingCount: 0,
      importedCount: 1,
      failedCount: 1,
      missingCount: 1,
    });
    expect(mocks.setHomeAssetTopN).toHaveBeenLastCalledWith(20);
    expect(
      mocks.setIncludeWatchAddressesInHomeAssetSelection,
    ).toHaveBeenLastCalledWith(true);
  });

  it('rejects imports in production before touching account state', async () => {
    const { module, mocks } = loadImportModule({ isNonProduction: false });

    await expect(
      module.importHighCardinalityWatchAddresses([FIRST_ADDRESS]),
    ).rejects.toThrow('non-production only');
    expect(mocks.fetchAccounts).not.toHaveBeenCalled();
    expect(mocks.addWatchAddress).not.toHaveBeenCalled();
  });
});
