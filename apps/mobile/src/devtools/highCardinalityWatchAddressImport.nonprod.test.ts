const FIRST_ADDRESS = '0x0000000000000000000000000000000000000001';
const SECOND_ADDRESS = '0x0000000000000000000000000000000000000002';
const THIRD_ADDRESS = '0x0000000000000000000000000000000000000003';
const FIXTURE_URL = 'https://fixtures.example.test/public-100.json';

function makePublicFixture(overrides: Record<string, unknown> = {}) {
  const addresses = [FIRST_ADDRESS, SECOND_ADDRESS, THIRD_ADDRESS];
  return JSON.stringify({
    schemaVersion: 1,
    fixtureId: 'public-benchmark-snapshot',
    addressCount: addresses.length,
    semantics: {
      stableBenchmarkCorpus: true,
      liveRanking: false,
      containsPrivateUserFixtures: false,
    },
    addresses,
    ...overrides,
  });
}

function loadImportModule({ isNonProduction = true } = {}) {
  jest.resetModules();
  const addWatchAddresses = jest.fn();
  const getPublicAccountSnapshotAccounts = jest.fn();
  const hasKeyringPublicAccountSnapshot = jest.fn(() => true);
  const getAllVisibleAccountsArray = jest.fn();
  const getHomeAssetSelectionSettings = jest.fn(() => ({
    topN: 20,
    includeWatchAddresses: true,
  }));
  const setIncludeWatchAddressesInHomeAssetSelection = jest.fn();

  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv: isNonProduction,
  }));
  jest.doMock('@/constant/homeAssetSelection', () => ({
    DEFAULT_HOME_ASSET_TOP_N: 10,
  }));
  jest.doMock('@/core/apis/address', () => ({ addWatchAddresses }));
  jest.doMock('@/core/serviceApi/keyring', () => ({
    getPublicAccountSnapshotAccounts,
    hasKeyringPublicAccountSnapshot,
    keyringServiceApi: { getAllVisibleAccountsArray },
  }));
  jest.doMock('@/hooks/appSettings', () => ({
    getHomeAssetSelectionSettings,
    setIncludeWatchAddressesInHomeAssetSelection,
  }));
  return {
    module:
      require('./highCardinalityWatchAddressImport.nonprod') as typeof import('./highCardinalityWatchAddressImport.nonprod'),
    mocks: {
      addWatchAddresses,
      getPublicAccountSnapshotAccounts,
      hasKeyringPublicAccountSnapshot,
      getAllVisibleAccountsArray,
      setIncludeWatchAddressesInHomeAssetSelection,
    },
  };
}

describe('high-cardinality Watch-address import', () => {
  it('accepts a bounded public benchmark fixture contract', () => {
    const { module } = loadImportModule();

    const fixture = module.parseHighCardinalityWatchAddressFixture(
      makePublicFixture(),
    );

    expect(fixture.fixtureId).toBe('public-benchmark-snapshot');
    expect(fixture.addresses).toEqual([
      FIRST_ADDRESS,
      SECOND_ADDRESS,
      THIRD_ADDRESS,
    ]);
  });

  it('rejects invalid, private, mismatched, or duplicate fixtures', () => {
    const { module } = loadImportModule();

    expect(() =>
      module.parseHighCardinalityWatchAddressFixture(
        makePublicFixture({ fixtureId: '' }),
      ),
    ).toThrow('identity is invalid');
    expect(() =>
      module.parseHighCardinalityWatchAddressFixture(
        makePublicFixture({
          semantics: { containsPrivateUserFixtures: true },
        }),
      ),
    ).toThrow('privacy marker is missing');
    expect(() =>
      module.parseHighCardinalityWatchAddressFixture(
        makePublicFixture({ addressCount: 2 }),
      ),
    ).toThrow('count does not match');
    expect(() =>
      module.parseHighCardinalityWatchAddressFixture(
        makePublicFixture({
          addresses: [FIRST_ADDRESS, FIRST_ADDRESS, THIRD_ADDRESS],
        }),
      ),
    ).toThrow('duplicate addresses');
  });

  it('accepts only credential-free HTTPS fixture links', () => {
    const { module } = loadImportModule();

    expect(
      module.normalizeHighCardinalityWatchAddressFixtureUrl(
        `  ${FIXTURE_URL}  `,
      ),
    ).toBe(FIXTURE_URL);
    expect(() =>
      module.normalizeHighCardinalityWatchAddressFixtureUrl(
        'http://fixtures.example.test/public.json',
      ),
    ).toThrow('must use HTTPS');
    expect(() =>
      module.normalizeHighCardinalityWatchAddressFixtureUrl(
        'https://user:pass@fixtures.example.test/public.json',
      ),
    ).toThrow('must not contain credentials');
  });

  it('downloads the user-supplied fixture URL before parsing it', async () => {
    const { module } = loadImportModule();
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => makePublicFixture(),
    });

    const fixture = await module.fetchHighCardinalityWatchAddressFixture(
      FIXTURE_URL,
      { fetcher },
    );

    expect(fetcher).toHaveBeenCalledWith(
      FIXTURE_URL,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fixture.addresses).toHaveLength(3);
  });

  it('times out even when the native fetch promise ignores abort', async () => {
    jest.useFakeTimers();
    try {
      const { module } = loadImportModule();
      const fetcher = jest.fn(() => new Promise<never>(() => undefined));

      const request = module.fetchHighCardinalityWatchAddressFixture(
        FIXTURE_URL,
        { fetcher },
      );
      jest.advanceTimersByTime(20_000);

      await expect(request).rejects.toThrow('request timed out');
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects public fixture downloads in production before networking', async () => {
    const { module } = loadImportModule({ isNonProduction: false });
    const fetcher = jest.fn();

    await expect(
      module.fetchHighCardinalityWatchAddressFixture(FIXTURE_URL, { fetcher }),
    ).rejects.toThrow('non-production only');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('imports missing addresses once and restores the selected policy', async () => {
    const { module, mocks } = loadImportModule();
    mocks.getPublicAccountSnapshotAccounts
      .mockReturnValueOnce([{ address: FIRST_ADDRESS }])
      .mockReturnValueOnce([
        { address: FIRST_ADDRESS },
        { address: SECOND_ADDRESS },
        { address: THIRD_ADDRESS },
      ]);
    mocks.addWatchAddresses.mockResolvedValue([SECOND_ADDRESS, THIRD_ADDRESS]);
    const onProgress = jest.fn();

    const result = await module.importHighCardinalityWatchAddresses(
      [FIRST_ADDRESS, SECOND_ADDRESS, THIRD_ADDRESS],
      { onProgress },
    );

    expect(mocks.addWatchAddresses).toHaveBeenCalledWith([
      SECOND_ADDRESS,
      THIRD_ADDRESS,
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
    expect(
      mocks.setIncludeWatchAddressesInHomeAssetSelection.mock.calls,
    ).toEqual([[false], [true]]);
  });

  it('does not restart Home selection for an idempotent import', async () => {
    const { module, mocks } = loadImportModule();
    const existingAccounts = [
      { address: FIRST_ADDRESS },
      { address: SECOND_ADDRESS },
    ];
    mocks.getPublicAccountSnapshotAccounts.mockReturnValue(existingAccounts);

    const result = await module.importHighCardinalityWatchAddresses([
      FIRST_ADDRESS,
      SECOND_ADDRESS,
    ]);

    expect(result).toMatchObject({
      existingCount: 2,
      importedCount: 0,
      missingCount: 0,
    });
    expect(mocks.addWatchAddresses).not.toHaveBeenCalled();
    expect(
      mocks.setIncludeWatchAddressesInHomeAssetSelection,
    ).not.toHaveBeenCalled();
  });

  it('reports partial failures without losing policy restoration', async () => {
    const { module, mocks } = loadImportModule();
    mocks.getPublicAccountSnapshotAccounts
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ address: FIRST_ADDRESS }]);
    mocks.addWatchAddresses.mockResolvedValueOnce([FIRST_ADDRESS]);

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
    expect(
      mocks.setIncludeWatchAddressesInHomeAssetSelection,
    ).toHaveBeenLastCalledWith(true);
  });

  it('falls back to the keyring runtime when no authoritative snapshot exists', async () => {
    const { module, mocks } = loadImportModule();
    mocks.hasKeyringPublicAccountSnapshot.mockReturnValue(false);
    mocks.getPublicAccountSnapshotAccounts.mockReturnValue([]);
    mocks.getAllVisibleAccountsArray
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ address: FIRST_ADDRESS }]);
    mocks.addWatchAddresses.mockResolvedValueOnce([FIRST_ADDRESS]);

    const result = await module.importHighCardinalityWatchAddresses([
      FIRST_ADDRESS,
    ]);

    expect(result.fixtureAddressCount).toBe(1);
    expect(mocks.getAllVisibleAccountsArray).toHaveBeenCalledTimes(2);
  });

  it('rejects imports in production before touching account state', async () => {
    const { module, mocks } = loadImportModule({ isNonProduction: false });

    await expect(
      module.importHighCardinalityWatchAddresses([FIRST_ADDRESS]),
    ).rejects.toThrow('non-production only');
    expect(mocks.getPublicAccountSnapshotAccounts).not.toHaveBeenCalled();
    expect(mocks.getAllVisibleAccountsArray).not.toHaveBeenCalled();
    expect(mocks.addWatchAddresses).not.toHaveBeenCalled();
  });
});
