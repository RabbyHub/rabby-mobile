import type { Account } from '@/core/startupServices/preference';

const mockGetDelegatorSummary = jest.fn();

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));
jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: {
        getDelegatorSummary: (...args: unknown[]) =>
          mockGetDelegatorSummary(...args),
      },
    }),
  },
}));
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getUserAbstractionForAddress: jest.fn(async () => null),
    setUserAbstractionForAddress: jest.fn(async () => undefined),
    clearUserAbstractionForAddress: jest.fn(async () => undefined),
    setCurrentAccount: jest.fn(async () => undefined),
  },
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
  scheduleStartupTask: jest.fn(),
}));
jest.mock('@/utils/events', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), removeAllListeners: jest.fn() },
  EVENTS: { PERPS: {} },
}));

import {
  fetchStakingSummaryHttp,
  initialState,
  perpsStore,
  switchPerpsAccountBeforeNavigate,
} from './usePerpsStore';

const ACCOUNT_A = {
  address: '0x1111111111111111111111111111111111111111',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;
const ACCOUNT_B = {
  address: '0x2222222222222222222222222222222222222222',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;

const summary = (delegated: string) => ({
  delegated,
  undelegated: '0.5',
  totalPendingWithdrawal: '2',
  nPendingWithdrawals: 1,
});

describe('fetchStakingSummaryHttp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    perpsStore.setState({ ...initialState });
  });

  it('does nothing without a current account', async () => {
    await expect(fetchStakingSummaryHttp()).resolves.toBe(false);

    expect(mockGetDelegatorSummary).not.toHaveBeenCalled();
    expect(perpsStore.getState().stakingStatus).toBe('idle');
  });

  it('ignores a request for an address that is not the current account', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });

    await expect(fetchStakingSummaryHttp(ACCOUNT_B.address)).resolves.toBe(
      false,
    );

    expect(mockGetDelegatorSummary).not.toHaveBeenCalled();
  });

  it('publishes the staking snapshot for the current account', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    mockGetDelegatorSummary.mockResolvedValue(summary('10'));

    await expect(fetchStakingSummaryHttp(ACCOUNT_A.address)).resolves.toBe(
      true,
    );

    expect(mockGetDelegatorSummary).toHaveBeenCalledWith(ACCOUNT_A.address);
    const state = perpsStore.getState();
    expect(state.stakingStatus).toBe('success');
    expect(state.stakingSummary).toEqual({
      delegated: '10',
      undelegated: '0.5',
      totalPendingWithdrawal: '2',
    });
  });

  it('drops a response that lands after the account switched away', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    let resolve!: (value: unknown) => void;
    mockGetDelegatorSummary.mockReturnValue(
      new Promise(r => {
        resolve = r;
      }),
    );

    const task = fetchStakingSummaryHttp(ACCOUNT_A.address);
    expect(perpsStore.getState().stakingStatus).toBe('loading');
    switchPerpsAccountBeforeNavigate(ACCOUNT_B);
    resolve(summary('10'));

    await expect(task).resolves.toBe(false);
    const state = perpsStore.getState();
    expect(state.stakingSummary).toBeNull();
    expect(state.stakingStatus).toBe('idle');
  });

  it('keeps the object identity and success status on an unchanged refresh', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    mockGetDelegatorSummary.mockResolvedValue(summary('10'));
    await fetchStakingSummaryHttp(ACCOUNT_A.address);
    const first = perpsStore.getState().stakingSummary;

    await fetchStakingSummaryHttp(ACCOUNT_A.address);

    expect(mockGetDelegatorSummary).toHaveBeenCalledTimes(2);
    expect(perpsStore.getState().stakingSummary).toBe(first);
    expect(perpsStore.getState().stakingStatus).toBe('success');
  });

  it('keeps the last good snapshot when a refresh fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    mockGetDelegatorSummary.mockResolvedValueOnce(summary('10'));
    await fetchStakingSummaryHttp(ACCOUNT_A.address);
    mockGetDelegatorSummary.mockRejectedValueOnce(new Error('boom'));

    await expect(fetchStakingSummaryHttp(ACCOUNT_A.address)).resolves.toBe(
      false,
    );

    const state = perpsStore.getState();
    expect(state.stakingStatus).toBe('success');
    expect(state.stakingSummary?.delegated).toBe('10');
    consoleError.mockRestore();
  });

  it('reports error when the first fetch fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    mockGetDelegatorSummary.mockRejectedValueOnce(new Error('boom'));

    await expect(fetchStakingSummaryHttp()).resolves.toBe(false);

    expect(perpsStore.getState().stakingStatus).toBe('error');
    expect(perpsStore.getState().stakingSummary).toBeNull();
    consoleError.mockRestore();
  });

  it('shares one in-flight request per address', async () => {
    perpsStore.setState({ currentPerpsAccount: ACCOUNT_A });
    mockGetDelegatorSummary.mockResolvedValue(summary('10'));

    await Promise.all([
      fetchStakingSummaryHttp(),
      fetchStakingSummaryHttp(ACCOUNT_A.address),
    ]);

    expect(mockGetDelegatorSummary).toHaveBeenCalledTimes(1);
  });
});
