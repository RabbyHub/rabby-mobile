function loadFixtureModule() {
  jest.resetModules();
  jest.doMock('@rabby-wallet/react-native-fs', () => ({
    ExternalDirectoryPath: '/external',
    DocumentDirectoryPath: '/documents',
  }));

  return require('./fixture.nonprod') as typeof import('./fixture.nonprod');
}

describe('high-cardinality watch-address regression fixture', () => {
  it('normalizes and de-duplicates JSON address fixtures', () => {
    const { parseRegressionWatchAddressFixture } = loadFixtureModule();

    expect(
      parseRegressionWatchAddressFixture(
        JSON.stringify({
          addresses: [
            '0xAa00000000000000000000000000000000000001',
            '0xaa00000000000000000000000000000000000001',
            '0xBb00000000000000000000000000000000000002',
          ],
        }),
      ),
    ).toEqual({
      addresses: [
        '0xaa00000000000000000000000000000000000001',
        '0xbb00000000000000000000000000000000000002',
      ],
    });
  });

  it('accepts plain-text address lists', () => {
    const { parseRegressionWatchAddressFixture } = loadFixtureModule();

    expect(
      parseRegressionWatchAddressFixture(
        '0xCc00000000000000000000000000000000000003\n0xDd00000000000000000000000000000000000004',
      ),
    ).toEqual({
      addresses: [
        '0xcc00000000000000000000000000000000000003',
        '0xdd00000000000000000000000000000000000004',
      ],
    });
  });

  it('accepts the public ranked-address fixture shape', () => {
    const { parseRegressionWatchAddressFixture } = loadFixtureModule();

    expect(
      parseRegressionWatchAddressFixture(
        JSON.stringify({
          schemaVersion: 1,
          fixtures: [
            {
              address: '0xEe00000000000000000000000000000000000005',
              rank: 1,
            },
            {
              address: '0xFf00000000000000000000000000000000000006',
              rank: 2,
            },
          ],
        }),
      ),
    ).toEqual({
      addresses: [
        '0xee00000000000000000000000000000000000005',
        '0xff00000000000000000000000000000000000006',
      ],
    });
  });

  it('rejects malformed and oversized address fixtures', () => {
    const {
      MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES,
      parseRegressionWatchAddressFixture,
    } = loadFixtureModule();

    expect(() =>
      parseRegressionWatchAddressFixture(
        JSON.stringify({ addresses: ['bad'] }),
      ),
    ).toThrow('invalid EVM address');

    const addresses = Array.from(
      { length: MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES + 1 },
      (_, index) => `0x${index.toString(16).padStart(40, '0')}`,
    );
    expect(() =>
      parseRegressionWatchAddressFixture(JSON.stringify({ addresses })),
    ).toThrow('exceeds');
  });

  it('rejects a wallet secret accidentally supplied as a Watch fixture', () => {
    const { parseRegressionWatchAddressFixture } = loadFixtureModule();

    expect(() =>
      parseRegressionWatchAddressFixture(
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ),
    ).toThrow('must not contain private keys');
  });
});
