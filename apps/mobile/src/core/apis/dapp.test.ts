const mockHasPermission = jest.fn();
const mockDisconnect = jest.fn();
const mockRemoveDapp = jest.fn();
const mockPatchDapps = jest.fn();
const mockAddDapp = jest.fn();
const mockUpdateDapp = jest.fn();
const mockBroadcastEvent = jest.fn();
const mockGetPinAddresses = jest.fn();
const mockGetFallbackAccount = jest.fn();
const mockGetDappsInfo = jest.fn();
const mockCached = jest.fn((fn: unknown) => fn);
const mockGetAllAccountsToDisplay = jest.fn();
const mockSortAccountList = jest.fn();
const mockFindChain = jest.fn();

let mockDapps: Record<string, any> = {};

const mockDappService = {
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
  disconnect: (...args: unknown[]) => mockDisconnect(...args),
  removeDapp: (...args: unknown[]) => mockRemoveDapp(...args),
  getDapp: (origin: string) => mockDapps[origin],
  patchDapps: (...args: unknown[]) => mockPatchDapps(...args),
  addDapp: (...args: unknown[]) => mockAddDapp(...args),
  getDapps: () => mockDapps,
  updateDapp: (...args: unknown[]) => mockUpdateDapp(...args),
};

const mockPreferenceService = {
  getPinAddresses: (...args: unknown[]) => mockGetPinAddresses(...args),
  getFallbackAccount: (...args: unknown[]) => mockGetFallbackAccount(...args),
};

const mockSessionService = {
  broadcastEvent: (...args: unknown[]) => mockBroadcastEvent(...args),
};

const loadDappModule = () => {
  jest.resetModules();

  jest.doMock('../services', () => ({
    dappService: mockDappService,
  }));

  jest.doMock('../services/shared', () => ({
    preferenceService: mockPreferenceService,
    sessionService: mockSessionService,
  }));

  jest.doMock('@/constant/event', () => ({
    BroadcastEvent: {
      accountsChanged: 'accountsChanged',
      chainChanged: 'chainChanged',
    },
  }));

  jest.doMock('../request', () => ({
    openapi: {
      getDappsInfo: (...args: unknown[]) => mockGetDappsInfo(...args),
    },
  }));

  jest.doMock('@/utils/cache', () => ({
    cached: (...args: unknown[]) => mockCached(...args),
  }));

  jest.doMock('@rabby-wallet/base-utils', () => ({
    stringUtils: {
      ensurePrefix: (value: string, prefix: string) =>
        value.startsWith(prefix) ? value : `${prefix}${value}`,
    },
  }));

  jest.doMock('./account', () => ({
    getAllAccountsToDisplay: (...args: unknown[]) =>
      mockGetAllAccountsToDisplay(...args),
  }));

  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_CLASS: {
      WATCH: 'WatchAddressKeyring',
      GNOSIS: 'GnosisKeyring',
    },
  }));

  jest.doMock('@/utils/sortAccountList', () => ({
    sortAccountList: (...args: unknown[]) => mockSortAccountList(...args),
  }));

  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
  }));

  return require('./dapp') as typeof import('./dapp');
};

const account = (address: string, type = 'SimpleKeyring') => ({
  address,
  type,
  brandName: type,
});

describe('core/apis/dapp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDapps = {};
    mockPatchDapps.mockImplementation((patches: Record<string, any>) => {
      Object.entries(patches).forEach(([origin, patch]) => {
        mockDapps[origin] = {
          ...(mockDapps[origin] || { origin }),
          ...patch,
        };
      });
    });
    mockAddDapp.mockImplementation(dapp => {
      mockDapps[dapp.origin] = dapp;
    });
    mockUpdateDapp.mockImplementation(dapp => {
      mockDapps[dapp.origin] = dapp;
    });
    mockGetPinAddresses.mockReturnValue([]);
    mockGetFallbackAccount.mockReturnValue(account('0xfallback'));
    mockGetAllAccountsToDisplay.mockResolvedValue([]);
    mockSortAccountList.mockImplementation(accounts => accounts);
    mockGetDappsInfo.mockResolvedValue([]);
    mockFindChain.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('disconnects only permitted origins and removeDapp delegates through disconnect first', () => {
    const { disconnect, removeDapp } = loadDappModule();

    mockHasPermission.mockReturnValue(false);
    disconnect('https://blocked.example');

    expect(mockBroadcastEvent).not.toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();

    mockHasPermission.mockReturnValue(true);
    removeDapp('https://connected.example');

    expect(mockBroadcastEvent).toHaveBeenCalledWith(
      'accountsChanged',
      [],
      'https://connected.example',
    );
    expect(mockDisconnect).toHaveBeenCalledWith('https://connected.example');
    expect(mockRemoveDapp).toHaveBeenCalledWith('https://connected.example');
  });

  it('connects a new dapp with the first non-watch account from the sorted account list', async () => {
    const { connect } = loadDappModule();
    const watch = account('0xwatch', 'WatchAddressKeyring');
    const mine = account('0xmine', 'SimpleKeyring');
    const pinAddresses = [{ address: '0xmine', brandName: 'SimpleKeyring' }];
    mockGetPinAddresses.mockReturnValue(pinAddresses);
    mockGetAllAccountsToDisplay.mockResolvedValue([mine, watch]);
    mockSortAccountList.mockReturnValue([watch, mine]);

    await connect({
      origin: 'https://app.example',
      chainId: 'eth' as never,
      info: {
        id: 'app.example',
        name: 'Demo App',
        logo_url: 'https://logo.example',
      } as never,
    });

    expect(mockSortAccountList).toHaveBeenCalledWith([mine, watch], {
      highlightedAddresses: pinAddresses,
    });
    expect(mockAddDapp).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'https://app.example',
        name: 'Demo App',
        chainId: 'eth',
        currentAccount: mine,
        isConnected: true,
      }),
    );
  });

  it('patches existing dapps and lets explicit current account override stored selection', async () => {
    const { connect } = loadDappModule();
    const stored = account('0xstored');
    const explicit = account('0xexplicit');
    mockDapps['https://app.example'] = {
      origin: 'https://app.example',
      currentAccount: stored,
    };

    await connect({
      origin: 'https://app.example',
      chainId: 'bsc' as never,
      currentAccount: explicit,
    });

    expect(mockPatchDapps).toHaveBeenCalledWith({
      'https://app.example': {
        chainId: 'bsc',
        isConnected: true,
        currentAccount: explicit,
      },
    });
    expect(mockAddDapp).not.toHaveBeenCalled();
  });

  it('sets current account for connected dapps and broadcasts lowercased accountsChanged', () => {
    const { setCurrentAccountForDapp } = loadDappModule();
    const fallback = account('0xABCDEF');
    mockGetFallbackAccount.mockReturnValue(fallback);
    mockDapps['https://app.example'] = {
      origin: 'https://app.example',
      isConnected: true,
      currentAccount: null,
    };

    expect(setCurrentAccountForDapp('https://app.example')).toBe(fallback);

    expect(mockPatchDapps).toHaveBeenCalledWith({
      'https://app.example': {
        currentAccount: fallback,
      },
    });
    expect(mockBroadcastEvent).toHaveBeenCalledWith(
      'accountsChanged',
      ['0xabcdef'],
      'https://app.example',
    );
  });

  it('syncs basic dapp info for normalized origin ids', async () => {
    const { syncBasicDappInfo } = loadDappModule();
    const info = {
      id: 'foo.example',
      name: 'Foo',
    };
    mockGetDappsInfo.mockResolvedValue([info, { id: '' }]);

    await expect(
      syncBasicDappInfo(['https://foo.example', '']),
    ).resolves.toEqual({
      'https://foo.example': {
        origin: 'https://foo.example',
        info,
      },
    });

    expect(mockGetDappsInfo).toHaveBeenCalledWith({
      ids: ['foo.example'],
    });
    expect(mockPatchDapps).toHaveBeenCalledWith({
      'https://foo.example': {
        info,
      },
    });
  });

  it('refreshes stale dapp info and leaves fresh or empty origins alone', async () => {
    const { syncBasicDappsInfo } = loadDappModule();
    jest.useFakeTimers().setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
    mockDapps = {
      'https://stale.example': {
        origin: 'https://stale.example',
        infoUpdateAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
      },
      'https://fresh.example': {
        origin: 'https://fresh.example',
        infoUpdateAt: Date.now(),
      },
      empty: {
        origin: '',
      },
    };
    const info = {
      id: 'stale.example',
      name: 'Stale',
    };
    mockGetDappsInfo.mockResolvedValue([info]);

    await syncBasicDappsInfo();

    expect(mockGetDappsInfo).toHaveBeenCalledWith({
      ids: ['stale.example'],
    });
    expect(mockPatchDapps).toHaveBeenCalledWith({
      'https://stale.example': {
        info,
        infoUpdateAt: Date.now(),
      },
    });
  });

  it('broadcasts chainChanged when an active dapp switches to a known chain', () => {
    const { updateDappChain } = loadDappModule();
    mockFindChain.mockReturnValue({
      hex: '0x38',
      network: '56',
    });
    const dapp = {
      origin: 'https://app.example',
      isConnected: true,
      chainId: 'bsc',
    };

    updateDappChain(dapp as never);

    expect(mockUpdateDapp).toHaveBeenCalledWith(dapp);
    expect(mockBroadcastEvent).toHaveBeenCalledWith(
      'chainChanged',
      {
        chainId: '0x38',
        networkVersion: '56',
      },
      'https://app.example',
    );
  });
});
