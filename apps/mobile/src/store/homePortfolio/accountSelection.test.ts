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
  (accounts: Array<{ address: string }>, options: { topCount: number }) => {
    const topRecords = new Set<string>();
    accounts.forEach(account => {
      if (topRecords.size < options.topCount) {
        topRecords.add(account.address.toLowerCase());
      }
    });
    return {
      topAccounts: accounts.filter(account =>
        topRecords.has(account.address.toLowerCase()),
      ),
      topAddresses: Array.from(topRecords),
      topRecords,
      restAccounts: accounts.filter(
        account => !topRecords.has(account.address.toLowerCase()),
      ),
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

describe('home account selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the legacy Top-10 behavior for the production-compatible default', () => {
    const accounts = Array.from({ length: 12 }, (_, index) => ({
      address: `0x${index}`,
    }));

    const selection = pickHomeAccountSelectionFromSortedAccounts(accounts);

    expect(selection.selectedAddresses).toEqual(
      accounts.slice(0, 10).map(account => account.address),
    );
    expect(mockFilterOutTop10Accounts).toHaveBeenCalledWith(accounts, {
      gatherSameAddress: false,
    });
    expect(mockFilterOutTopAccounts).not.toHaveBeenCalled();
  });

  it('preserves distinct legacy account records that share an address', () => {
    const accounts = [
      { address: '0xaaa', brandName: 'Rabby' },
      { address: '0xAAA', brandName: 'Ledger' },
      ...Array.from({ length: 9 }, (_, index) => ({
        address: `0x${index}`,
        brandName: 'Rabby',
      })),
    ];

    const selection = pickHomeAccountSelectionFromSortedAccounts(accounts);

    expect(selection.selectedAccounts).toEqual(accounts.slice(0, 10));
    expect(selection.restAccounts).toEqual(accounts.slice(10));
  });

  it('counts unique addresses for an explicit non-production Top-N policy', () => {
    const accounts = [
      { address: '0xaaa' },
      { address: '0xAAA' },
      { address: '0xbbb' },
      { address: '0xccc' },
      { address: '0xddd' },
    ];

    const selection = pickHomeAccountSelectionFromSortedAccounts(accounts, {
      topN: 3,
      uniqueAddresses: true,
    });

    expect(selection.selectedAddresses).toEqual(['0xaaa', '0xbbb', '0xccc']);
    expect(selection.selectedAccounts.map(account => account.address)).toEqual([
      '0xaaa',
      '0xbbb',
      '0xccc',
    ]);
  });

  it('accepts only the reviewed Top-N tiers', () => {
    expect(coerceHomeAssetTopN(50)).toBe(50);
    expect(coerceHomeAssetTopN('100')).toBe(100);
    expect(coerceHomeAssetTopN(75)).toBe(DEFAULT_HOME_ASSET_TOP_N);
  });
});
