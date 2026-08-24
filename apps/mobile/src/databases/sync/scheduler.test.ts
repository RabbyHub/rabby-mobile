jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

const loadScheduler = () =>
  require('./scheduler') as typeof import('./scheduler');

describe('database sync scheduler critical mode', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('lets high-priority work pass while normal work is held', async () => {
    const scheduler = loadScheduler();
    const normalRunner = jest.fn(async () => 'normal');
    const highRunner = jest.fn(async () => 'high');

    scheduler.setSyncSchedulerCriticalMode(true, 'visible-work-test');
    const normalTask = scheduler.submitSyncTask({
      key: 'normal-test',
      taskFor: 'token',
      owner: 'test',
      entityName: 'TokenItemEntity',
      rowCount: 1,
      batchSize: 1,
      totalBatches: 1,
      priority: 'normal',
      runner: normalRunner,
    });
    const highTask = scheduler.submitSyncTask({
      key: 'high-test',
      taskFor: 'balance',
      owner: 'test',
      entityName: 'BalanceItemEntity',
      rowCount: 1,
      batchSize: 1,
      totalBatches: 1,
      priority: 'high',
      runner: highRunner,
    });

    await expect(highTask.promise).resolves.toBe('high');
    expect(highRunner).toHaveBeenCalledTimes(1);
    expect(normalRunner).not.toHaveBeenCalled();
    expect(scheduler.getSyncSchedulerSnapshot().tasks[0]).toMatchObject({
      key: 'normal-test',
      status: 'paused',
    });

    scheduler.setSyncSchedulerCriticalMode(false, 'visible-work-test');
    await expect(normalTask.promise).resolves.toBe('normal');
  });

  it('pauses an active normal task at its next cooperative boundary', async () => {
    const scheduler = loadScheduler();
    let releaseFirstBatch!: () => void;
    let markFirstBatchReached!: () => void;
    let secondBatchStarted = false;
    const firstBatchReached = new Promise<void>(resolve => {
      markFirstBatchReached = resolve;
    });
    const continueAfterFirstBatch = new Promise<void>(resolve => {
      releaseFirstBatch = resolve;
    });

    const task = scheduler.submitSyncTask({
      key: 'active-normal-test',
      taskFor: 'token',
      owner: 'test',
      entityName: 'TokenItemEntity',
      rowCount: 2,
      batchSize: 1,
      totalBatches: 2,
      priority: 'normal',
      runner: async ctx => {
        await ctx.waitIfPaused();
        markFirstBatchReached();
        await continueAfterFirstBatch;
        await ctx.waitIfPaused();
        secondBatchStarted = true;
      },
    });

    await firstBatchReached;
    scheduler.setSyncSchedulerCriticalMode(true, 'visible-work-test');
    releaseFirstBatch();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(secondBatchStarted).toBe(false);
    expect(scheduler.getSyncSchedulerSnapshot().tasks[0]).toMatchObject({
      key: 'active-normal-test',
      status: 'paused',
    });

    scheduler.setSyncSchedulerCriticalMode(false, 'visible-work-test');
    await expect(task.promise).resolves.toBeUndefined();
    expect(secondBatchStarted).toBe(true);
  });
});
