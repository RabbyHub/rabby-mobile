const ADDRESS_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ADDRESS_A_UPPER = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ADDRESS_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ADDRESS_B_UPPER = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

type WhitelistStore = {
  enabled: boolean;
  whitelists: Array<
    | string
    | {
        addedAt?: number | null;
        address: string;
      }
  >;
};

function loadWhitelistServiceModule(persistedStore?: WhitelistStore) {
  jest.resetModules();

  const mockCreatePersistStore = jest.fn(() => persistedStore);
  const mockIsSameAddress = jest.fn(
    (left?: string, right?: string) =>
      (left || '').toLowerCase() === (right || '').toLowerCase(),
  );

  jest.doMock('@rabby-wallet/base-utils', () => ({
    addressUtils: {
      isSameAddress: (...args: unknown[]) => mockIsSameAddress(...args),
    },
  }));
  jest.doMock('@rabby-wallet/persist-store', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockCreatePersistStore(...args),
  }));
  jest.doMock('@/core/storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      whitelist: 'whitelist',
    },
  }));

  const { WhitelistService } =
    require('./whitelist') as typeof import('./whitelist');

  return {
    WhitelistService,
    mocks: {
      mockCreatePersistStore,
      mockIsSameAddress,
    },
  };
}

describe('core/services/whitelist', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('normalizes persisted whitelist records and forces the whitelist feature enabled on construction', () => {
    const { WhitelistService } = loadWhitelistServiceModule({
      enabled: false,
      whitelists: [
        ADDRESS_A_UPPER,
        {
          addedAt: 1,
          address: ADDRESS_A,
        },
        {
          addedAt: 2,
          address: ADDRESS_B_UPPER,
        },
      ],
    });

    const service = new WhitelistService();

    expect(service.isWhitelistEnabled()).toBe(true);
    expect(service.getWhitelistRecords()).toEqual([
      {
        address: ADDRESS_A,
      },
      {
        addedAt: 2,
        address: ADDRESS_B,
      },
    ]);
    expect(service.getWhitelist()).toEqual([ADDRESS_A, ADDRESS_B]);
  });

  it('adds, syncs, checks, removes, and toggles whitelist records case-insensitively', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(100);
    const { WhitelistService } = loadWhitelistServiceModule();
    const service = new WhitelistService();

    service.addWhitelist(ADDRESS_A_UPPER);
    service.addWhitelist(ADDRESS_A);

    expect(service.isInWhiteList(ADDRESS_A_UPPER)).toBe(true);
    expect(service.getWhitelistRecords()).toEqual([
      {
        addedAt: 100,
        address: ADDRESS_A,
      },
    ]);

    nowSpy.mockReturnValue(200);
    service.setWhitelist([ADDRESS_A_UPPER, ADDRESS_B_UPPER]);

    expect(service.getWhitelistRecords()).toEqual([
      {
        addedAt: 100,
        address: ADDRESS_A,
      },
      {
        addedAt: 200,
        address: ADDRESS_B,
      },
    ]);

    service.removeWhitelist(ADDRESS_A_UPPER);
    expect(service.isInWhiteList(ADDRESS_A)).toBe(false);
    expect(service.getWhitelist()).toEqual([ADDRESS_B]);

    service.disableWhiteList();
    expect(service.isWhitelistEnabled()).toBe(false);
    service.enableWhitelist();
    expect(service.isWhitelistEnabled()).toBe(true);
  });
});
