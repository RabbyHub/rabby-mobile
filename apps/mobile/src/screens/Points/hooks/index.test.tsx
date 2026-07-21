import { act, renderHook } from '@testing-library/react-native';

import { useGetRabbyPoints } from './index';

const mockFetchAccounts = jest.fn();
const mockGetRabbyPointsV2 = jest.fn();
const mockUseAccounts = jest.fn();

jest.mock('@/core/request', () => ({
  openapi: {
    getRabbyPointsV2: (params: { id: string }) => mockGetRabbyPointsV2(params),
  },
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));

jest.mock('@/hooks/account', () => ({
  useAccounts: () => mockUseAccounts(),
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_CLASS: {
    WATCH: 'Watch Address',
    GNOSIS: 'Gnosis',
  },
}));

describe('useGetRabbyPoints', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    jest.clearAllMocks();

    mockUseAccounts.mockReturnValue({
      accounts: Array.from({ length: 101 }, (_, index) => ({
        address: `0x${index.toString(16).padStart(40, '0')}`,
        type: 'Simple Key Pair',
      })),
      fetchAccounts: mockFetchAccounts,
    });
    mockGetRabbyPointsV2.mockImplementation(async ({ id }) => ({
      id,
      claimed_points: 0,
    }));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts at most 20 point requests per second and 100 per minute', async () => {
    renderHook(() => useGetRabbyPoints());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetRabbyPointsV2).toHaveBeenCalledTimes(20);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(999);
    });
    expect(mockGetRabbyPointsV2).toHaveBeenCalledTimes(20);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(mockGetRabbyPointsV2).toHaveBeenCalledTimes(40);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockGetRabbyPointsV2).toHaveBeenCalledTimes(100);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(55_000);
    });
    expect(mockGetRabbyPointsV2).toHaveBeenCalledTimes(100);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockGetRabbyPointsV2).toHaveBeenCalledTimes(101);
  });
});
