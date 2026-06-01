const mockGetGasAccountInfoV2 = jest.fn();
const mockGetAccountsWithGasAccountBalance = jest.fn();
const mockIsUnlocked = jest.fn();
const mockGetAccountList = jest.fn();
const mockFilterDirectlySignableAccounts = jest.fn();
const mockIsHardwareAccount = jest.fn();

jest.mock('@/core/request', () => ({
  openapi: {
    getGasAccountInfoV2: (...args: unknown[]) =>
      mockGetGasAccountInfoV2(...args),
  },
}));

jest.mock('@/core/services', () => ({
  gasAccountService: {
    getAccountsWithGasAccountBalance: (...args: unknown[]) =>
      mockGetAccountsWithGasAccountBalance(...args),
  },
  keyringService: {
    isUnlocked: (...args: unknown[]) => mockIsUnlocked(...args),
  },
}));

jest.mock('@/core/apis/account', () => ({
  getAccountList: (...args: unknown[]) => mockGetAccountList(...args),
  filterDirectlySignableAccounts: (...args: unknown[]) =>
    mockFilterDirectlySignableAccounts(...args),
  isHardwareAccount: (...args: unknown[]) => mockIsHardwareAccount(...args),
}));

jest.mock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
  isSameAddress: (a?: string, b?: string) =>
    a?.toLowerCase() === b?.toLowerCase(),
}));

import {
  autoLoginGasAccountIfNeeded,
  checkAddedAccountsGasAccountIfNeeded,
  refreshAccountsWithGasAccountBalance,
  resetAutoLoginFlag,
} from './autoLoginGasAccount';
import { setGasAccountStoreApi } from './gasAccountStoreApiBridge';

type TestAccount = {
  address: string;
  type: string;
  brandName?: string;
};

const directAccount = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'SimpleKeyring',
} as TestAccount;

const directAccountUpper = {
  address: '0x1111111111111111111111111111111111111111'.toUpperCase(),
  type: 'SimpleKeyring',
} as TestAccount;

const hardwareAccount = {
  address: '0x2222222222222222222222222222222222222222',
  type: 'HardwareKeyring',
  brandName: 'Ledger',
} as TestAccount;

const emptyAccount = {
  address: '0x3333333333333333333333333333333333333333',
  type: 'SimpleKeyring',
} as TestAccount;

const balanceInfo = (balance: string | number) => ({
  account: {
    balance,
  },
});

const createStoreApi = () => ({
  getSession: jest.fn(() => ({})),
  setAccountsWithGasAccountBalance: jest.fn(),
  loginGasAccount: jest.fn().mockResolvedValue(undefined),
  clearPendingHardwareAccount: jest.fn(),
  setPendingHardwareAccount: jest.fn(),
});

describe('autoLoginGasAccount utilities', () => {
  let storeApi: ReturnType<typeof createStoreApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetAutoLoginFlag();
    storeApi = createStoreApi();
    setGasAccountStoreApi(storeApi);
    mockGetAccountsWithGasAccountBalance.mockReturnValue([]);
    mockIsUnlocked.mockReturnValue(true);
    mockFilterDirectlySignableAccounts.mockImplementation(
      (accounts: TestAccount[]) =>
        accounts.filter(account => account.type === 'SimpleKeyring'),
    );
    mockIsHardwareAccount.mockImplementation(
      (account: TestAccount) => account.type === 'HardwareKeyring',
    );
    mockGetGasAccountInfoV2.mockResolvedValue(balanceInfo('0'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes all owned accounts and stores only accounts with gas balance', async () => {
    mockGetAccountList.mockResolvedValue({
      sortedAccounts: [directAccount, emptyAccount, hardwareAccount],
    });
    mockGetGasAccountInfoV2
      .mockResolvedValueOnce(balanceInfo('1.25'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(balanceInfo('0'));

    await expect(refreshAccountsWithGasAccountBalance()).resolves.toEqual([
      {
        address: directAccount.address,
        type: directAccount.type,
        brandName: directAccount.brandName,
      },
    ]);

    expect(mockGetAccountList).toHaveBeenCalledWith({ filter: 'onlyMine' });
    expect(storeApi.setAccountsWithGasAccountBalance).toHaveBeenCalledWith([
      {
        address: directAccount.address,
        type: directAccount.type,
        brandName: directAccount.brandName,
      },
    ]);
  });

  it('clears stored gas-balance accounts when there are no owned accounts', async () => {
    mockGetAccountList.mockResolvedValue({ sortedAccounts: [] });

    await expect(refreshAccountsWithGasAccountBalance()).resolves.toEqual([]);

    expect(storeApi.setAccountsWithGasAccountBalance).toHaveBeenCalledWith([]);
    expect(mockGetGasAccountInfoV2).not.toHaveBeenCalled();
  });

  it('returns cached gas-balance accounts when refresh throws', async () => {
    const cached = [
      {
        address: hardwareAccount.address,
        type: hardwareAccount.type,
        brandName: hardwareAccount.brandName,
      },
    ];
    mockGetAccountsWithGasAccountBalance.mockReturnValue(cached);
    mockGetAccountList.mockRejectedValue(new Error('boom'));

    await expect(refreshAccountsWithGasAccountBalance()).resolves.toBe(cached);
  });

  it('does not auto-login when the gas account session is already signed', async () => {
    storeApi.getSession.mockReturnValue({ sig: 'signed' });

    await autoLoginGasAccountIfNeeded();
    await autoLoginGasAccountIfNeeded();

    expect(mockGetAccountList).not.toHaveBeenCalled();
    expect(storeApi.loginGasAccount).not.toHaveBeenCalled();
  });

  it('auto-logins the first direct account with balance when the wallet is unlocked', async () => {
    mockGetAccountList.mockResolvedValue({
      sortedAccounts: [emptyAccount, directAccountUpper, hardwareAccount],
    });
    mockGetAccountsWithGasAccountBalance.mockReturnValue([
      {
        address: directAccount.address,
        type: directAccount.type,
      },
    ]);
    mockGetGasAccountInfoV2
      .mockResolvedValueOnce(balanceInfo('0'))
      .mockResolvedValueOnce(balanceInfo('2'))
      .mockResolvedValue(balanceInfo('2'));

    await autoLoginGasAccountIfNeeded();

    expect(storeApi.loginGasAccount).toHaveBeenCalledWith(directAccountUpper);
    expect(storeApi.clearPendingHardwareAccount).toHaveBeenCalled();
    expect(storeApi.setAccountsWithGasAccountBalance).toHaveBeenCalledWith([
      {
        address: directAccount.address,
        type: directAccount.type,
      },
    ]);
    expect(storeApi.setPendingHardwareAccount).not.toHaveBeenCalled();
  });

  it('sets pending hardware account when direct auto-login cannot run', async () => {
    mockIsUnlocked.mockReturnValue(false);
    mockGetAccountList.mockResolvedValue({
      sortedAccounts: [directAccount, hardwareAccount],
    });
    mockGetGasAccountInfoV2
      .mockResolvedValueOnce(balanceInfo('1'))
      .mockResolvedValueOnce(balanceInfo('5'))
      .mockResolvedValue(balanceInfo('5'));

    await autoLoginGasAccountIfNeeded();

    expect(storeApi.loginGasAccount).not.toHaveBeenCalled();
    expect(storeApi.setPendingHardwareAccount).toHaveBeenCalledWith({
      address: hardwareAccount.address,
      type: hardwareAccount.type,
      brandName: hardwareAccount.brandName,
    });
  });

  it('checks newly added accounts, merges balances, and defers hardware when locked', async () => {
    mockIsUnlocked.mockReturnValue(false);
    mockGetAccountsWithGasAccountBalance.mockReturnValue([
      {
        address: directAccountUpper.address,
        type: directAccountUpper.type,
      },
    ]);
    mockGetGasAccountInfoV2
      .mockResolvedValueOnce(balanceInfo('1'))
      .mockResolvedValueOnce(balanceInfo('4'));

    await checkAddedAccountsGasAccountIfNeeded([
      directAccount,
      hardwareAccount,
    ] as any);

    expect(storeApi.setAccountsWithGasAccountBalance).toHaveBeenCalledWith([
      {
        address: directAccountUpper.address,
        type: directAccountUpper.type,
      },
      {
        address: hardwareAccount.address,
        type: hardwareAccount.type,
        brandName: hardwareAccount.brandName,
      },
    ]);
    expect(storeApi.loginGasAccount).not.toHaveBeenCalled();
    expect(storeApi.setPendingHardwareAccount).toHaveBeenCalledWith({
      address: hardwareAccount.address,
      type: hardwareAccount.type,
      brandName: hardwareAccount.brandName,
    });
  });

  it('checks newly added accounts and logs in direct accounts before pending hardware', async () => {
    mockGetGasAccountInfoV2
      .mockResolvedValueOnce(balanceInfo('3'))
      .mockResolvedValueOnce(balanceInfo('4'));

    await checkAddedAccountsGasAccountIfNeeded([
      directAccount,
      hardwareAccount,
    ] as any);

    expect(storeApi.setAccountsWithGasAccountBalance).toHaveBeenCalledWith([
      {
        address: directAccount.address,
        type: directAccount.type,
        brandName: directAccount.brandName,
      },
      {
        address: hardwareAccount.address,
        type: hardwareAccount.type,
        brandName: hardwareAccount.brandName,
      },
    ]);
    expect(storeApi.loginGasAccount).toHaveBeenCalledWith(directAccount);
    expect(storeApi.clearPendingHardwareAccount).toHaveBeenCalled();
    expect(storeApi.setPendingHardwareAccount).not.toHaveBeenCalled();
  });

  it('skips newly added account checks when a gas-account session exists', async () => {
    storeApi.getSession.mockReturnValue({ sig: 'signed' });

    await checkAddedAccountsGasAccountIfNeeded([
      directAccount,
      hardwareAccount,
    ] as any);

    expect(mockGetGasAccountInfoV2).not.toHaveBeenCalled();
    expect(storeApi.setAccountsWithGasAccountBalance).not.toHaveBeenCalled();
  });
});
