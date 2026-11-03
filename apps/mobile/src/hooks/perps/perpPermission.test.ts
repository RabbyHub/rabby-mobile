import type { Account } from '@/core/startupServices/preference';

const mockGetPerpPermission = jest.fn();

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));
jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: () => ({ info: {}, ws: {} }) },
}));
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    setCurrentAccount: jest.fn(async () => undefined),
  },
}));
jest.mock('@/core/request', () => ({
  openapi: {
    getPerpPermission: (...args: unknown[]) => mockGetPerpPermission(...args),
  },
}));
jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
  scheduleStartupTask: jest.fn(),
}));
jest.mock('@/utils/events', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), removeAllListeners: jest.fn() },
  EVENTS: { PERPS: {} },
}));

import {
  ensureCurrentPerpPermission,
  hasCurrentPerpPermission,
  initialState,
  perpsStore,
} from './usePerpsStore';

const ACCOUNT_A = {
  address: '0xAAaa000000000000000000000000000000000001',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;
const ACCOUNT_B = {
  address: '0xbbbb000000000000000000000000000000000002',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('Perps address-bound permission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    perpsStore.setState({ ...initialState, currentPerpsAccount: ACCOUNT_A });
  });

  it('denies until checked and treats a failed check as denied', async () => {
    expect(hasCurrentPerpPermission()).toBe(false);

    mockGetPerpPermission.mockRejectedValueOnce(new Error('timeout'));
    await expect(ensureCurrentPerpPermission(ACCOUNT_A)).resolves.toBe(false);
    expect(perpsStore.getState().hasPermission).toBe(true);
    expect(hasCurrentPerpPermission()).toBe(false);

    mockGetPerpPermission.mockResolvedValueOnce({ has_permission: true });
    await expect(ensureCurrentPerpPermission(ACCOUNT_A)).resolves.toBe(true);
    expect(mockGetPerpPermission).toHaveBeenLastCalledWith({
      id: ACCOUNT_A.address,
    });
  });

  it('never applies a result to another address', async () => {
    mockGetPerpPermission.mockResolvedValueOnce({ has_permission: true });
    await ensureCurrentPerpPermission(ACCOUNT_A);

    const requestA = deferred<{ has_permission: boolean }>();
    perpsStore.setState({ permissionAddress: null });
    mockGetPerpPermission.mockReturnValueOnce(requestA.promise);
    const pendingA = ensureCurrentPerpPermission(ACCOUNT_A);

    perpsStore.setState({ currentPerpsAccount: ACCOUNT_B });
    expect(hasCurrentPerpPermission()).toBe(false);
    mockGetPerpPermission.mockResolvedValueOnce({ has_permission: false });
    await expect(ensureCurrentPerpPermission(ACCOUNT_B)).resolves.toBe(false);

    requestA.resolve({ has_permission: true });
    await expect(pendingA).resolves.toBe(false);
    expect(perpsStore.getState()).toMatchObject({
      hasPermission: false,
      permissionAddress: ACCOUNT_B.address,
    });
    expect(hasCurrentPerpPermission()).toBe(false);
  });
});
