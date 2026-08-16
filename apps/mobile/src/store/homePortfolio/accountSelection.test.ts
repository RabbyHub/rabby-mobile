import {
  DEFAULT_HOME_ASSET_TOP_N,
  coerceHomeAssetTopN,
} from '@/constant/homeAssetSelection';

const mockFilterOutTop10Accounts = jest.fn(
  (accounts: Array<{ address: string }>) => {
    const top10Accounts = accounts.slice(0, 10);
    const top10Records = new Set(
      top10Accounts.map(account => account.address.toLowerCase()),
    );

    return {
      top10Accounts,
      top10Addresses: Array.from(top10Records),
      top10Records,
      restAccounts: accounts.slice(10),
    };
  },
);

const mockFilterOutTopAccounts = jest.fn(
  (
    accounts: Array<{ address: string }>,
    options: { topCount: number; gatherSameAddress: boolean },
  ) => {
    const topRecords = new Set<string>();
    accounts.forEach(item => {
      if (topRecords.size < options.topCount) {
        topRecords.add(item.address.toLowerCase());
      }
    });

    const topAccounts = options.gatherSameAddress
      ? accounts.filter(item => topRecords.has(item.address.toLowerCase()))
      : accounts.slice(0, options.topCount);

    return {
      topAccounts,
      topAddresses: Array.from(topRecords),
      topRecords,
      restAccounts: options.gatherSameAddress
        ? accounts.filter(item => !topRecords.has(item.address.toLowerCase()))
        : accounts.slice(options.topCount),
    };
  },
);

jest.mock('@/core/apis/account', () => ({
  filterOutTop10Accounts: (...args: unknown[]) =>
    mockFilterOutTop10Accounts(...args),
  filterOutTopAccounts: (...args: unknown[]) =>
    mockFilterOutTopAccounts(...args),
}));

import { pickHomeAccountSelectionFromSortedAccounts } from './accountSelection';

type TestAccount = {
  address: string;
  label: string;
};

function account(address: string, label: string): TestAccount {
  return { address, label };
}

describe('home account selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the legacy Top-10 account and address selection behavior by default', () => {
    const accounts = [
      account('0xAaA', 'a-primary'),
      account('0xaaa', 'a-secondary'),
      account('0xbbb', 'b'),
      account('0xccc', 'c'),
      account('0xddd', 'd'),
      account('0xeee', 'e'),
      account('0xfff', 'f'),
      account('0x111', 'g'),
      account('0x222', 'h'),
      account('0x333', 'i'),
      account('0x444', 'j'),
      account('0x555', 'k'),
    ];

    const selection = pickHomeAccountSelectionFromSortedAccounts(accounts);

    // This matches filterOutTop10Accounts({ gatherSameAddress: false }): the
    // first ten account records define the scope, then duplicate addresses are
    // collapsed only for the downstream balance work.
    expect(selection.selectedAddresses).toEqual([
      '0xaaa',
      '0xbbb',
      '0xccc',
      '0xddd',
      '0xeee',
      '0xfff',
      '0x111',
      '0x222',
      '0x333',
    ]);
    expect(selection.selectedAccounts.map(item => item.label)).toEqual([
      'a-primary',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
    ]);
    expect(selection.restAccounts.map(item => item.label)).toEqual(['j', 'k']);
    expect(mockFilterOutTop10Accounts).toHaveBeenCalledWith(accounts, {
      gatherSameAddress: false,
    });
  });

  it('counts unique addresses for an explicit Top-N capacity policy', () => {
    const accounts = [
      account('0xAaA', 'a-primary'),
      account('0xaaa', 'a-secondary'),
      account('0xbbb', 'b'),
      account('0xccc', 'c-primary'),
      account('0xCCC', 'c-secondary'),
      account('0xddd', 'd'),
    ];

    const selection = pickHomeAccountSelectionFromSortedAccounts(accounts, {
      topN: 3,
      uniqueAddresses: true,
    });

    expect(selection.selectedAddresses).toEqual(['0xaaa', '0xbbb', '0xccc']);
    expect(selection.selectedAccounts.map(item => item.label)).toEqual([
      'a-primary',
      'b',
      'c-primary',
    ]);
    expect(selection.restAccounts.map(item => item.label)).toEqual(['d']);
    expect(mockFilterOutTopAccounts).toHaveBeenCalledWith(accounts, {
      topCount: 3,
      gatherSameAddress: true,
    });
  });

  it('only accepts reviewed capacity tiers', () => {
    expect(coerceHomeAssetTopN(50)).toBe(50);
    expect(coerceHomeAssetTopN('100')).toBe(100);
    expect(coerceHomeAssetTopN(75)).toBe(DEFAULT_HOME_ASSET_TOP_N);
  });
});
