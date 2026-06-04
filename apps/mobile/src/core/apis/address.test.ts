const KEYRING_TYPE = {
  WatchAddressKeyring: 'WatchAddressKeyring',
  GnosisKeyring: 'GnosisKeyring',
  WalletConnectKeyring: 'WalletConnectKeyring',
  SimpleKeyring: 'SimpleKeyring',
  HdKeyring: 'HdKeyring',
} as const;

type Account = {
  address: string;
  type: string;
  brandName: string;
};

function createAccount(account: Partial<Account> = {}): Account {
  return {
    address: '0xabc',
    type: KEYRING_TYPE.SimpleKeyring,
    brandName: 'rabby',
    ...account,
  };
}

function loadAddressModule({
  allAccounts = [],
  currentAccount = null,
  dapps = {},
  hasAddress = false,
  isUnlocked = true,
}: {
  allAccounts?: Account[];
  currentAccount?: Account | null;
  dapps?: Record<string, Record<string, unknown>>;
  hasAddress?: boolean;
  isUnlocked?: boolean;
} = {}) {
  jest.resetModules();

  let fallbackAccount = currentAccount;
  const mockWatchKeyring = {
    setAccountToAdd: jest.fn(),
  };
  const mockGetKeyring = jest.fn().mockResolvedValue(mockWatchKeyring);
  const mockAddNewAccount = jest.fn().mockResolvedValue({
    address: '0xwatch',
  });
  const mockRemoveAccount = jest.fn().mockResolvedValue(undefined);
  const mockHasAddress = jest.fn().mockResolvedValue(hasAddress);
  const mockGetAllVisibleAccountsArray = jest
    .fn()
    .mockResolvedValue(allAccounts);
  const mockSetCurrentAccount = jest.fn((account: Account | null) => {
    fallbackAccount = account;
  });
  const mockGetFallbackAccount = jest.fn(() => fallbackAccount);
  const mockRemoveAddressAvatar = jest.fn();
  const mockRemovePinAddress = jest.fn();
  const mockInitCurrentAccount = jest.fn();
  const mockRemoveAlias = jest.fn();
  const mockRemoveWhitelist = jest.fn();
  const mockRemoveList = jest.fn();
  const mockRemoveAgentWallet = jest.fn();
  const mockGetDapps = jest.fn(() => dapps);
  const mockUpdateDapp = jest.fn();
  const mockBroadcastEvent = jest.fn();
  const mockRemoveTestnetAddressBalanceCache = jest.fn();
  const mockIsUnlocked = jest.fn(() => isUnlocked);

  jest.doMock('@rabby-wallet/base-utils', () => ({
    addressUtils: {
      isSameAddress: (left?: string, right?: string) =>
        (left || '').toLowerCase() === (right || '').toLowerCase(),
    },
  }));
  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_TYPE,
  }));
  jest.doMock('@rabby-wallet/eth-keyring-watch', () => jest.fn());
  jest.doMock('@/core/apis/lock', () => ({
    isUnlocked: (...args: unknown[]) => mockIsUnlocked(...args),
  }));
  jest.doMock('@/constant/event', () => ({
    BroadcastEvent: {
      accountsChanged: 'accountsChanged',
    },
  }));
  jest.doMock('@/utils/testnetAddressBalanceCache', () => ({
    removeTestnetAddressBalanceCache: (...args: unknown[]) =>
      mockRemoveTestnetAddressBalanceCache(...args),
  }));
  jest.doMock('./keyring', () => ({
    getKeyring: (...args: unknown[]) => mockGetKeyring(...args),
  }));
  jest.doMock('../services', () => ({
    contactService: {
      removeAlias: mockRemoveAlias,
    },
    dappService: {
      getDapps: mockGetDapps,
      updateDapp: mockUpdateDapp,
    },
    keyringService: {
      addNewAccount: mockAddNewAccount,
      getAllVisibleAccountsArray: mockGetAllVisibleAccountsArray,
      hasAddress: mockHasAddress,
      removeAccount: mockRemoveAccount,
    },
    perpsService: {
      removeAgentWallet: mockRemoveAgentWallet,
    },
    preferenceService: {
      getFallbackAccount: mockGetFallbackAccount,
      initCurrentAccount: mockInitCurrentAccount,
      removeAddressAvatar: mockRemoveAddressAvatar,
      removePinAddress: mockRemovePinAddress,
      setCurrentAccount: mockSetCurrentAccount,
    },
    sessionService: {
      broadcastEvent: mockBroadcastEvent,
    },
    transactionHistoryService: {
      removeList: mockRemoveList,
    },
    whitelistService: {
      removeWhitelist: mockRemoveWhitelist,
    },
  }));

  const addressModule = require('./address') as typeof import('./address');

  return {
    ...addressModule,
    mocks: {
      mockAddNewAccount,
      mockBroadcastEvent,
      mockGetAllVisibleAccountsArray,
      mockGetDapps,
      mockGetFallbackAccount,
      mockGetKeyring,
      mockHasAddress,
      mockInitCurrentAccount,
      mockIsUnlocked,
      mockRemoveAccount,
      mockRemoveAddressAvatar,
      mockRemoveAgentWallet,
      mockRemoveAlias,
      mockRemoveList,
      mockRemovePinAddress,
      mockRemoveTestnetAddressBalanceCache,
      mockRemoveWhitelist,
      mockSetCurrentAccount,
      mockUpdateDapp,
      mockWatchKeyring,
    },
  };
}

describe('core/apis/address', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('adds a watch address through the watch keyring and initializes current account', async () => {
    const { addWatchAddress, mocks } = loadAddressModule();

    await expect(addWatchAddress('0xwatch')).resolves.toEqual({
      address: '0xwatch',
    });

    expect(mocks.mockGetKeyring).toHaveBeenCalledWith(
      KEYRING_TYPE.WatchAddressKeyring,
    );
    expect(mocks.mockWatchKeyring.setAccountToAdd).toHaveBeenCalledWith(
      '0xwatch',
    );
    expect(mocks.mockAddNewAccount).toHaveBeenCalledWith(
      mocks.mockWatchKeyring,
    );
    expect(mocks.mockInitCurrentAccount).toHaveBeenCalledTimes(1);
  });

  it('filters reportable accounts into callable and uncallable groups', async () => {
    const simple = createAccount({
      address: '0xsimple',
      type: KEYRING_TYPE.SimpleKeyring,
    });
    const hd = createAccount({
      address: '0xhd',
      type: KEYRING_TYPE.HdKeyring,
    });
    const watch = createAccount({
      address: '0xwatch',
      type: KEYRING_TYPE.WatchAddressKeyring,
    });
    const gnosis = createAccount({
      address: '0xgnosis',
      type: KEYRING_TYPE.GnosisKeyring,
    });
    const { getAllMyAccount, getAddressesForReport, mocks } = loadAddressModule(
      {
        allAccounts: [simple, watch, gnosis, hd],
      },
    );

    await expect(getAllMyAccount()).resolves.toEqual([simple, hd]);
    await expect(getAddressesForReport()).resolves.toEqual({
      myCallableAddresses: ['0xsimple', '0xhd'],
      myCallableAddressCount: 2,
      myUncallableAddresses: ['0xwatch', '0xgnosis'],
      myUncallableAddressCount: 2,
    });
    expect(mocks.mockGetAllVisibleAccountsArray).toHaveBeenCalledTimes(2);
  });

  it('fully cleans up the last removed address and moves connected dapps to the next current account', async () => {
    const removedAccount = createAccount({
      address: '0xABC',
      type: KEYRING_TYPE.SimpleKeyring,
    });
    const nextAccount = createAccount({
      address: '0xdef',
      type: KEYRING_TYPE.HdKeyring,
    });
    const matchingDapp = {
      currentAccount: {
        address: '0xabc',
        type: KEYRING_TYPE.SimpleKeyring,
        brandName: 'rabby',
      },
      isConnected: true,
      name: 'matching dapp',
    };
    const otherDapp = {
      currentAccount: createAccount({
        address: '0x999',
      }),
      isConnected: true,
      name: 'other dapp',
    };
    const { removeAddress, mocks } = loadAddressModule({
      allAccounts: [nextAccount],
      currentAccount: removedAccount,
      dapps: {
        'https://app.example': matchingDapp,
        'https://other.example': otherDapp,
      },
      hasAddress: false,
      isUnlocked: true,
    });

    await removeAddress(removedAccount);

    expect(mocks.mockIsUnlocked).toHaveBeenCalledTimes(1);
    expect(mocks.mockRemoveAccount).toHaveBeenCalledWith(
      '0xABC',
      KEYRING_TYPE.SimpleKeyring,
      'rabby',
      true,
    );
    expect(mocks.mockHasAddress).toHaveBeenCalledWith('0xABC');
    expect(mocks.mockRemoveTestnetAddressBalanceCache).toHaveBeenCalledWith(
      '0xABC',
    );
    expect(mocks.mockRemoveAddressAvatar).toHaveBeenCalledWith('0xABC');
    expect(mocks.mockRemoveAlias).toHaveBeenCalledWith('0xABC');
    expect(mocks.mockRemoveWhitelist).toHaveBeenCalledWith('0xABC');
    expect(mocks.mockRemoveList).toHaveBeenCalledWith('0xABC');
    expect(mocks.mockRemoveAgentWallet).toHaveBeenCalledWith('0xABC');
    expect(mocks.mockRemovePinAddress).toHaveBeenCalledWith(removedAccount);
    expect(mocks.mockSetCurrentAccount).toHaveBeenCalledWith(nextAccount);
    expect(mocks.mockUpdateDapp).toHaveBeenCalledTimes(1);
    expect(mocks.mockUpdateDapp).toHaveBeenCalledWith({
      ...matchingDapp,
      origin: 'https://app.example',
      currentAccount: nextAccount,
    });
    expect(mocks.mockBroadcastEvent).toHaveBeenCalledWith(
      'accountsChanged',
      ['0xdef'],
      'https://app.example',
    );
  });

  it('keeps address-scoped data when another keyring still owns the same address', async () => {
    const walletConnectAccount = createAccount({
      address: '0xwalletconnect',
      type: KEYRING_TYPE.WalletConnectKeyring,
    });
    const otherCurrentAccount = createAccount({
      address: '0xother',
    });
    const { removeAddress, mocks } = loadAddressModule({
      currentAccount: otherCurrentAccount,
      hasAddress: true,
      isUnlocked: true,
    });

    await removeAddress(walletConnectAccount);

    expect(mocks.mockIsUnlocked).not.toHaveBeenCalled();
    expect(mocks.mockRemoveAccount).toHaveBeenCalledWith(
      '0xwalletconnect',
      KEYRING_TYPE.WalletConnectKeyring,
      'rabby',
      false,
    );
    expect(mocks.mockRemoveTestnetAddressBalanceCache).not.toHaveBeenCalled();
    expect(mocks.mockRemoveAddressAvatar).not.toHaveBeenCalled();
    expect(mocks.mockRemoveAlias).not.toHaveBeenCalled();
    expect(mocks.mockRemoveWhitelist).not.toHaveBeenCalled();
    expect(mocks.mockRemoveList).not.toHaveBeenCalled();
    expect(mocks.mockRemoveAgentWallet).not.toHaveBeenCalled();
    expect(mocks.mockSetCurrentAccount).not.toHaveBeenCalled();
  });

  it('requires an unlocked wallet before removing sensitive keyring accounts', async () => {
    const { removeAddress, mocks } = loadAddressModule({
      isUnlocked: false,
    });

    await expect(
      removeAddress(
        createAccount({
          type: KEYRING_TYPE.SimpleKeyring,
        }),
      ),
    ).rejects.toThrow('background.error.unlock');

    expect(mocks.mockRemoveAccount).not.toHaveBeenCalled();
  });
});
