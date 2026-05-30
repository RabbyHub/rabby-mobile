import { filterOutTopAccounts, getAccountList } from '../../apis/account';
import {
  findMyAccountByOwnerAddress,
  getTopMyAccountsOnNotifications,
} from '../utils';

jest.mock('../../apis/account', () => ({
  getAccountList: jest.fn(),
  filterOutTopAccounts: jest.fn((accounts, options) => {
    const topAccounts = accounts.slice(0, options.topCount);
    const restAccounts = accounts.slice(options.topCount);
    return {
      topAccounts,
      topAddresses: topAccounts.map((account: { address: string }) =>
        account.address.toLowerCase(),
      ),
      topRecords: topAccounts.map((account: { address: string }) => ({
        address: account.address,
        gatherSameAddress: options.gatherSameAddress,
      })),
      restAccounts,
    };
  }),
}));

const mockGetAccountList = getAccountList as jest.MockedFunction<
  typeof getAccountList
>;
const mockFilterOutTopAccounts = filterOutTopAccounts as jest.MockedFunction<
  typeof filterOutTopAccounts
>;

const accounts = [
  { address: '0x00000000000000000000000000000000000000AA' },
  { address: '0x00000000000000000000000000000000000000BB' },
  { address: '0x00000000000000000000000000000000000000CC' },
] as any[];

describe('notification utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccountList.mockResolvedValue({
      sortedAccounts: accounts,
    } as any);
  });

  it('returns top account records for notification targeting', async () => {
    await expect(
      getTopMyAccountsOnNotifications({ gatherSameAddress: true }),
    ).resolves.toEqual({
      top100Accounts: accounts,
      top100Addresses: accounts.map(account => account.address.toLowerCase()),
      top100Records: accounts.map(account => ({
        address: account.address,
        gatherSameAddress: true,
      })),
      restAccounts: [],
    });

    expect(mockGetAccountList).toHaveBeenCalledWith({ filter: 'onlyMine' });
    expect(mockFilterOutTopAccounts).toHaveBeenCalledWith(accounts, {
      topCount: 100,
      gatherSameAddress: true,
    });
  });

  it('shares the in-flight top-account request across concurrent callers', async () => {
    let resolveAccounts: (value: any) => void = jest.fn();
    mockGetAccountList.mockReset();
    mockGetAccountList.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveAccounts = resolve;
        }),
    );

    const p1 = getTopMyAccountsOnNotifications({ gatherSameAddress: false });
    const p2 = getTopMyAccountsOnNotifications({ gatherSameAddress: true });

    expect(mockGetAccountList).toHaveBeenCalledTimes(1);
    resolveAccounts({ sortedAccounts: accounts });

    await expect(Promise.all([p1, p2])).resolves.toEqual([
      {
        top100Accounts: accounts,
        top100Addresses: accounts.map(account => account.address.toLowerCase()),
        top100Records: accounts.map(account => ({
          address: account.address,
          gatherSameAddress: false,
        })),
        restAccounts: [],
      },
      {
        top100Accounts: accounts,
        top100Addresses: accounts.map(account => account.address.toLowerCase()),
        top100Records: accounts.map(account => ({
          address: account.address,
          gatherSameAddress: false,
        })),
        restAccounts: [],
      },
    ]);
  });

  it('finds a top account by owner address case-insensitively', async () => {
    await expect(
      findMyAccountByOwnerAddress('0x00000000000000000000000000000000000000aa'),
    ).resolves.toBe(accounts[0]);
  });

  it('returns null for empty or missing owner addresses', async () => {
    await expect(findMyAccountByOwnerAddress('')).resolves.toBe(null);
    await expect(
      findMyAccountByOwnerAddress('0x00000000000000000000000000000000000000dd'),
    ).resolves.toBe(null);
  });
});
