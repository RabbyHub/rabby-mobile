describe('user-visible work DB scheduler bridge', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('holds normal DB work across overlapping visible tasks', () => {
    const setSyncSchedulerCriticalMode = jest.fn();
    jest.doMock('./scheduler', () => ({
      setSyncSchedulerCriticalMode,
    }));

    const activity =
      require('@/core/utils/userVisibleJsWork') as typeof import('@/core/utils/userVisibleJsWork');
    const { startUserVisibleWorkSyncSchedulerBridge } =
      require('./userVisibleWorkBridge') as typeof import('./userVisibleWorkBridge');
    const stopBridge = startUserVisibleWorkSyncSchedulerBridge();

    const releaseToken = activity.beginUserVisibleJsWork('token-load');
    const releaseDefi = activity.beginUserVisibleJsWork('defi-load');
    expect(setSyncSchedulerCriticalMode).toHaveBeenCalledTimes(1);
    expect(setSyncSchedulerCriticalMode).toHaveBeenLastCalledWith(
      true,
      'user_visible_js_work',
    );

    releaseToken();
    expect(setSyncSchedulerCriticalMode).toHaveBeenCalledTimes(1);

    releaseDefi();
    expect(setSyncSchedulerCriticalMode).toHaveBeenLastCalledWith(
      false,
      'user_visible_js_work',
    );

    stopBridge();
    expect(setSyncSchedulerCriticalMode).toHaveBeenCalledTimes(2);
  });

  it('releases the scheduler when the bridge stops mid-work', () => {
    const setSyncSchedulerCriticalMode = jest.fn();
    jest.doMock('./scheduler', () => ({
      setSyncSchedulerCriticalMode,
    }));

    const activity =
      require('@/core/utils/userVisibleJsWork') as typeof import('@/core/utils/userVisibleJsWork');
    const { startUserVisibleWorkSyncSchedulerBridge } =
      require('./userVisibleWorkBridge') as typeof import('./userVisibleWorkBridge');
    const stopBridge = startUserVisibleWorkSyncSchedulerBridge();

    activity.beginUserVisibleJsWork('token-load');
    stopBridge();

    expect(setSyncSchedulerCriticalMode.mock.calls).toEqual([
      [true, 'user_visible_js_work'],
      [false, 'user_visible_js_work'],
    ]);
  });
});
