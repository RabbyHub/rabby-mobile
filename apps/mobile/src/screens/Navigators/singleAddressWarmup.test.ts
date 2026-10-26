const mockPreloadTransactionHotNavigator = jest.fn();
const mockRunStartupTask = jest.fn();

jest.mock('@/perfs/preloads', () => ({
  preloadTransactionHotNavigator: () => mockPreloadTransactionHotNavigator(),
}));

jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: (...args: unknown[]) => mockRunStartupTask(...args),
}));

import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { scheduleSingleAddressTransactionNavigatorWarmup } from './singleAddressWarmup';

describe('single-address transaction navigator warmup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers route-owned preload work at the governed idle stage', async () => {
    const handle = { cancel: jest.fn() };
    mockRunStartupTask.mockReturnValue(handle);

    expect(scheduleSingleAddressTransactionNavigatorWarmup()).toBe(handle);
    expect(mockRunStartupTask).toHaveBeenCalledWith(
      expect.any(Function),
      STARTUP_TASKS.singleAddressTransactionNavigatorWarmup,
    );

    const task = mockRunStartupTask.mock.calls[0][0];
    await task();

    expect(mockPreloadTransactionHotNavigator).toHaveBeenCalledTimes(1);
    expect(STARTUP_TASKS.singleAddressTransactionNavigatorWarmup).toMatchObject(
      {
        stage: 'homePostStartupIdle',
        priority: 'low',
      },
    );
  });
});
