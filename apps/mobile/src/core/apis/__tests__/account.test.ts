jest.mock('@rabby-wallet/keyring-utils', () => ({
  DisplayKeyring: class DisplayKeyring {
    keyring: unknown;
    constructor(keyring: unknown) {
      this.keyring = keyring;
    }
  },
  KEYRING_CLASS: {
    WATCH: 'WatchAddressKeyring',
    GNOSIS: 'GnosisKeyring',
    WALLETCONNECT: 'WalletConnectKeyring',
    HARDWARE: {
      LEDGER: 'LedgerKeyring',
      TREZOR: 'TrezorKeyring',
      KEYSTONE: 'KeystoneKeyring',
      ONEKEY: 'OneKeyKeyring',
    },
  },
  KEYRING_TYPE: {
    SimpleKeyring: 'SimpleKeyring',
    HdKeyring: 'HdKeyring',
  },
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/store/balance', () => ({
  hydrateCachedBalancesForAccounts: jest.fn(),
  getAddressValueMap: jest.fn(() => ({})),
}));

jest.mock('@/core/services', () => ({
  contactService: {
    getAliasByMap: jest.fn(async () => ({})),
    getAliasByAddress: jest.fn(() => null),
  },
  keyringService: {},
  preferenceService: {
    getPinAddresses: jest.fn(() => []),
  },
}));

jest.mock('../balance', () => ({
  getAddressCacheBalance: jest.fn(),
}));

jest.mock('../keyring', () => ({
  requestKeyring: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

import {
  filterDirectlySignableAccounts,
  filterMyAccounts,
  filterOutTop10Accounts,
  filterOutTopAccounts,
  isDirectlySignableAccount,
  isHardwareAccount,
  isMyAccount,
  sortAccountList,
  sortAccountsByBalance,
} from '../account';
import { isSameAccount } from '@/utils/isSameAccount';

const account = (
  address: string,
  balance: number,
  type = 'SimpleKeyring',
  brandName = type,
) => ({
  address,
  balance,
  type,
  brandName,
});

describe('account selection utilities', () => {
  it('sorts accounts by balance, then address, type and brand name without mutating input', () => {
    const accounts = [
      account('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 10, 'Z', 'B'),
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 10, 'B', 'C'),
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 10, 'A', 'Z'),
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 10, 'A', 'A'),
      account('0xcccccccccccccccccccccccccccccccccccccccc', 50, 'A', 'A'),
    ];

    expect(sortAccountsByBalance(accounts).map(item => item.brandName)).toEqual(
      ['A', 'A', 'Z', 'C', 'B'],
    );
    expect(accounts.map(item => item.address)).toEqual([
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xcccccccccccccccccccccccccccccccccccccccc',
    ]);
  });

  it('sorts highlighted accounts ahead of normal accounts and matches address case-insensitively with brand name', () => {
    const accounts = [
      account(
        '0x1111111111111111111111111111111111111111',
        100,
        'SimpleKeyring',
      ),
      account('0x2222222222222222222222222222222222222222', 10, 'HdKeyring'),
      account(
        '0x3333333333333333333333333333333333333333',
        500,
        'LedgerKeyring',
      ),
      account(
        '0x2222222222222222222222222222222222222222',
        999,
        'WatchAddressKeyring',
      ),
    ];

    expect(
      sortAccountList(accounts as any, {
        highlightedAddresses: [
          {
            address: '0x2222222222222222222222222222222222222222',
            brandName: 'HdKeyring',
          },
          {
            address: '0x3333333333333333333333333333333333333333'.toUpperCase(),
            brandName: 'LedgerKeyring',
          },
        ],
      }).map(item => `${item.brandName}:${item.balance}`),
    ).toEqual([
      'LedgerKeyring:500',
      'HdKeyring:10',
      'WatchAddressKeyring:999',
      'SimpleKeyring:100',
    ]);
  });

  it('identifies mine, directly signable and hardware accounts by keyring type', () => {
    expect(isMyAccount(account('0x1', 0, 'SimpleKeyring') as any)).toBe(true);
    expect(isMyAccount(account('0x1', 0, 'WatchAddressKeyring') as any)).toBe(
      false,
    );
    expect(isMyAccount(account('0x1', 0, 'GnosisKeyring') as any)).toBe(false);
    expect(isMyAccount(account('0x1', 0, 'WalletConnectKeyring') as any)).toBe(
      false,
    );

    expect(
      isDirectlySignableAccount(account('0x1', 0, 'SimpleKeyring') as any),
    ).toBe(true);
    expect(
      isDirectlySignableAccount(account('0x1', 0, 'HdKeyring') as any),
    ).toBe(true);
    expect(
      isDirectlySignableAccount(account('0x1', 0, 'LedgerKeyring') as any),
    ).toBe(false);

    expect(isHardwareAccount(account('0x1', 0, 'LedgerKeyring') as any)).toBe(
      true,
    );
    expect(isHardwareAccount(account('0x1', 0, 'TrezorKeyring') as any)).toBe(
      true,
    );
    expect(isHardwareAccount(account('0x1', 0, 'KeystoneKeyring') as any)).toBe(
      true,
    );
    expect(isHardwareAccount(account('0x1', 0, 'OneKeyKeyring') as any)).toBe(
      true,
    );
  });

  it('filters mine and directly signable accounts', () => {
    const accounts = [
      account('0x1', 0, 'SimpleKeyring'),
      account('0x2', 0, 'HdKeyring'),
      account('0x3', 0, 'LedgerKeyring'),
      account('0x4', 0, 'WatchAddressKeyring'),
      account('0x5', 0, 'GnosisKeyring'),
    ];

    expect(filterMyAccounts(accounts as any).map(item => item.address)).toEqual(
      ['0x1', '0x2', '0x3'],
    );
    expect(
      filterDirectlySignableAccounts(accounts as any).map(item => item.address),
    ).toEqual(['0x1', '0x2']);
  });

  it('splits top accounts without gathering duplicate addresses', () => {
    const accounts = [
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100),
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 90, 'HdKeyring'),
      account('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 80),
    ];

    const result = filterOutTopAccounts(accounts, {
      topCount: 2,
      gatherSameAddress: false,
    });

    expect(result.topAccounts.map(item => item.balance)).toEqual([100, 90]);
    expect(result.restAccounts.map(item => item.address)).toEqual([
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]);
    expect(result.topAddresses).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]);
    expect([...result.topRecords]).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]);
  });

  it('gathers all accounts with the same top addresses when requested', () => {
    const accounts = [
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 100),
      account('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 90),
      account('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 80, 'HdKeyring'),
      account('0xcccccccccccccccccccccccccccccccccccccccc', 70),
    ];

    const result = filterOutTopAccounts(accounts, {
      topCount: 2,
      gatherSameAddress: true,
    });

    expect(result.topAccounts.map(item => item.address)).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]);
    expect(result.restAccounts.map(item => item.address)).toEqual([
      '0xcccccccccccccccccccccccccccccccccccccccc',
    ]);
    expect(result.topAddresses).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]);
  });

  it('keeps the top10 compatibility wrapper shape', () => {
    const accounts = Array.from({ length: 12 }, (_, index) =>
      account(`0x${String(index).padStart(40, '0')}`, 12 - index),
    );

    const result = filterOutTop10Accounts(accounts);

    expect(result.top10Accounts).toHaveLength(10);
    expect(result.restAccounts).toHaveLength(2);
    expect(result.top10Addresses).toHaveLength(10);
    expect(result.top10Records).toBeInstanceOf(Set);
  });

  it('compares account identity by address case-insensitively plus brand and type', () => {
    const base = {
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      brandName: 'SimpleKeyring',
      type: 'SimpleKeyring',
    };

    expect(
      isSameAccount(base, {
        ...base,
        address: base.address.toUpperCase(),
      }),
    ).toBe(true);
    expect(isSameAccount(base, { ...base, brandName: 'HdKeyring' })).toBe(
      false,
    );
    expect(isSameAccount(base, { ...base, type: 'HdKeyring' })).toBe(false);
    expect(isSameAccount(base, null)).toBe(false);
  });
});
