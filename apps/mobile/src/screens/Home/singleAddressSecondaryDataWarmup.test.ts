const mockRunStartupTask = jest.fn();

jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: (...args: unknown[]) => mockRunStartupTask(...args),
}));

import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { scheduleSingleAddressHistoryBadgeWarmup } from './singleAddressSecondaryDataWarmup';

describe('single-address secondary data warmup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defers the initial history badge load without changing its task', async () => {
    const handle = { cancel: jest.fn() };
    const task = jest.fn(async () => undefined);
    mockRunStartupTask.mockReturnValue(handle);

    expect(scheduleSingleAddressHistoryBadgeWarmup(task)).toBe(handle);
    expect(mockRunStartupTask).toHaveBeenCalledWith(
      task,
      STARTUP_TASKS.singleAddressHistoryBadgeWarmup,
    );
    expect(STARTUP_TASKS.singleAddressHistoryBadgeWarmup).toMatchObject({
      stage: 'homePostStartupIdle',
      priority: 'low',
    });

    await mockRunStartupTask.mock.calls[0][0]();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
