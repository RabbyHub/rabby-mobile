const mockGetGasAccountInfo = jest.fn();
const mockMatomoRequestEvent = jest.fn();
const mockGetGasAccountSig = jest.fn();
const mockGetCurrentBalanceState = jest.fn();
const mockMarkLoggedIn = jest.fn();
const mockSetGasAccountSig = jest.fn();
const mockSetCurrentBalanceState = jest.fn();
const mockMarkGa4ActiveTracked = jest.fn();
const mockHasTrackedGa4ActiveToday = jest.fn();

jest.mock('@/core/request', () => ({
  openapi: {
    getGasAccountInfo: (...args: unknown[]) => mockGetGasAccountInfo(...args),
  },
}));

jest.mock('@/core/services/shared', () => ({
  gasAccountService: {
    getGasAccountSig: (...args: unknown[]) => mockGetGasAccountSig(...args),
    getCurrentBalanceState: (...args: unknown[]) =>
      mockGetCurrentBalanceState(...args),
    markLoggedIn: (...args: unknown[]) => mockMarkLoggedIn(...args),
    setGasAccountSig: (...args: unknown[]) => mockSetGasAccountSig(...args),
    setCurrentBalanceState: (...args: unknown[]) =>
      mockSetCurrentBalanceState(...args),
    markGa4ActiveTracked: (...args: unknown[]) =>
      mockMarkGa4ActiveTracked(...args),
    hasTrackedGa4ActiveToday: (...args: unknown[]) =>
      mockHasTrackedGa4ActiveToday(...args),
  },
}));

jest.mock('@/utils/analytics', () => ({
  matomoRequestEvent: (...args: unknown[]) => mockMatomoRequestEvent(...args),
}));

import {
  handleGasAccountLoginSuccess,
  trackGasAccountActiveStatusOncePerDay,
} from './gasAccountAnalytics';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'SimpleKeyring',
  brandName: 'Rabby',
} as any;

const gasInfo = (balance: string | number) => ({
  account: {
    balance,
  },
});

describe('gasAccountAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetGasAccountSig.mockReturnValue({ sig: '', accountId: '' });
    mockGetCurrentBalanceState.mockReturnValue({
      accountId: '',
      hasBalance: undefined,
    });
    mockMarkLoggedIn.mockReturnValue(false);
    mockHasTrackedGa4ActiveToday.mockReturnValue(false);
    mockGetGasAccountInfo.mockResolvedValue(gasInfo('0'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tracks first login and current active status when the account has balance', async () => {
    mockMarkLoggedIn.mockReturnValue(true);
    mockGetGasAccountInfo.mockResolvedValue(gasInfo('12.5'));

    await handleGasAccountLoginSuccess('sig-1', account);

    expect(mockSetGasAccountSig).toHaveBeenCalledWith('sig-1', account);
    expect(mockGetGasAccountInfo).toHaveBeenCalledWith({
      sig: 'sig-1',
      id: account.address,
    });
    expect(mockSetCurrentBalanceState).toHaveBeenCalledWith(
      account.address,
      true,
    );
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Gas Account',
      action: 'GasAccount_FirstLogin',
    });
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Gas Account',
      action: 'GasAccount_On_True',
    });
    expect(mockMarkGa4ActiveTracked).toHaveBeenCalledTimes(1);
  });

  it('tracks active status again when a logged-in account moves from no balance to balance', async () => {
    mockGetGasAccountSig.mockReturnValue({
      sig: 'previous-sig',
      accountId: account.address,
    });
    mockGetCurrentBalanceState.mockReturnValue({
      accountId: account.address,
      hasBalance: false,
    });
    mockGetGasAccountInfo.mockResolvedValue(gasInfo('1'));

    await handleGasAccountLoginSuccess('sig-2', account);

    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Gas Account',
      action: 'GasAccount_On_True',
    });
    expect(mockMatomoRequestEvent).not.toHaveBeenCalledWith({
      category: 'Gas Account',
      action: 'GasAccount_FirstLogin',
    });
  });

  it('does not duplicate active status when the logged-in account already had balance', async () => {
    mockGetGasAccountSig.mockReturnValue({
      sig: 'previous-sig',
      accountId: account.address,
    });
    mockGetCurrentBalanceState.mockReturnValue({
      accountId: account.address,
      hasBalance: true,
    });
    mockGetGasAccountInfo.mockResolvedValue(gasInfo('1'));

    await handleGasAccountLoginSuccess('sig-3', account);

    expect(mockSetCurrentBalanceState).toHaveBeenCalledWith(
      account.address,
      true,
    );
    expect(mockMatomoRequestEvent).not.toHaveBeenCalledWith({
      category: 'Gas Account',
      action: 'GasAccount_On_True',
    });
    expect(mockMarkGa4ActiveTracked).not.toHaveBeenCalled();
  });

  it('keeps the new signature but skips balance events when balance lookup fails', async () => {
    mockGetGasAccountInfo.mockRejectedValue(new Error('network'));

    await handleGasAccountLoginSuccess('sig-4', account);

    expect(mockSetGasAccountSig).toHaveBeenCalledWith('sig-4', account);
    expect(mockSetCurrentBalanceState).not.toHaveBeenCalled();
    expect(mockMatomoRequestEvent).not.toHaveBeenCalled();
    expect(mockMarkGa4ActiveTracked).not.toHaveBeenCalled();
  });

  it('does not track daily active status more than once per day', async () => {
    mockHasTrackedGa4ActiveToday.mockReturnValue(true);

    await expect(trackGasAccountActiveStatusOncePerDay()).resolves.toBe(false);

    expect(mockGetGasAccountInfo).not.toHaveBeenCalled();
  });

  it('tracks daily active status for signed accounts without balance', async () => {
    mockGetGasAccountSig.mockReturnValue({
      sig: 'daily-sig',
      accountId: account.address,
    });
    mockGetGasAccountInfo.mockResolvedValue(gasInfo('0'));

    await expect(trackGasAccountActiveStatusOncePerDay()).resolves.toBe(true);

    expect(mockSetCurrentBalanceState).toHaveBeenCalledWith(
      account.address,
      false,
    );
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Gas Account',
      action: 'GasAccount_On_False',
    });
    expect(mockMarkGa4ActiveTracked).toHaveBeenCalledTimes(1);
  });

  it('skips daily active status when there is no signed gas account', async () => {
    mockGetGasAccountSig.mockReturnValue({ sig: '', accountId: '' });

    await expect(trackGasAccountActiveStatusOncePerDay()).resolves.toBe(false);

    expect(mockGetGasAccountInfo).not.toHaveBeenCalled();
    expect(mockMatomoRequestEvent).not.toHaveBeenCalled();
  });
});
