const mockGetAliasByAddress = jest.fn();
const mockEllipsisAddress = jest.fn();

function loadAccountModule() {
  jest.resetModules();

  jest.doMock('@/core/services', () => ({
    contactService: {
      getAliasByAddress: (address: string) => mockGetAliasByAddress(address),
    },
  }));

  jest.doMock('@/core/apis/account', () => ({
    sortAccountsByBalance: jest.fn(),
    filterMyAccounts: jest.fn(),
  }));

  jest.doMock('./address', () => ({
    ellipsisAddress: (address: string) => mockEllipsisAddress(address),
  }));

  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_CLASS: {
      WATCH: 'WATCH',
      GNOSIS: 'GNOSIS',
      MNEMONIC: 'MNEMONIC',
      PRIVATE_KEY: 'PRIVATE_KEY',
      HARDWARE: {
        LEDGER: 'LEDGER',
        ONEKEY: 'ONEKEY',
      },
    },
    KEYRING_TYPE: {
      HdKeyring: 'HdKeyring',
      SimpleKeyring: 'SimpleKeyring',
      LedgerKeyring: 'LedgerKeyring',
      OneKeyKeyring: 'OneKeyKeyring',
      KeystoneKeyring: 'KeystoneKeyring',
      GnosisKeyring: 'GnosisKeyring',
    },
  }));

  return require('./account') as typeof import('./account');
}

describe('account utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findAccountByPriority sorts in place and returns the first supported type', () => {
    const { findAccountByPriority } = loadAccountModule();
    const accounts = [
      { address: '0xledger', type: 'LedgerKeyring' },
      { address: '0xunknown', type: 'UnknownKeyring' },
      { address: '0xhd', type: 'HdKeyring' },
    ] as any;

    const picked = findAccountByPriority(accounts);

    expect(picked.address).toBe('0xhd');
    expect(accounts.map(item => item.address)).toEqual([
      '0xhd',
      '0xledger',
      '0xunknown',
    ]);
  });

  it('stableSerializeAccounts sorts the original array before serializing', () => {
    const { stableSerializeAccounts } = loadAccountModule();
    const accounts = [
      { address: '0xb', type: 'SimpleKeyring' },
      { address: '0xa', type: 'HdKeyring' },
    ] as any;

    const serialized = stableSerializeAccounts(accounts);

    expect(serialized).toBe(
      JSON.stringify(
        [
          { address: '0xa', type: 'HdKeyring' },
          { address: '0xb', type: 'SimpleKeyring' },
        ],
        null,
        0,
      ),
    );
    expect(accounts.map(item => item.address)).toEqual(['0xa', '0xb']);
  });

  it('makeAccountObject prefers saved aliases over ellipsis fallback', () => {
    mockGetAliasByAddress.mockReturnValue({ alias: 'Primary Account' });
    const { makeAccountObject } = loadAccountModule();

    const account = makeAccountObject({
      address: '0xabc',
    });

    expect(account).toMatchObject({
      address: '0xabc',
      aliasName: 'Primary Account',
      brandName: 'WATCH',
      balance: 0,
      type: 'WATCH',
    });
    expect(mockEllipsisAddress).not.toHaveBeenCalled();
  });

  it('makeAccountObject falls back to ellipsisAddress when no alias exists', () => {
    mockGetAliasByAddress.mockReturnValue(undefined);
    mockEllipsisAddress.mockReturnValue('0xabc...def');
    const { makeAccountObject } = loadAccountModule();

    const account = makeAccountObject({
      address: '0xabc',
      brandName: 'CUSTOM',
    });

    expect(account.aliasName).toBe('0xabc...def');
    expect(account.brandName).toBe('CUSTOM');
    expect(mockEllipsisAddress).toHaveBeenCalledWith('0xabc');
  });
});
