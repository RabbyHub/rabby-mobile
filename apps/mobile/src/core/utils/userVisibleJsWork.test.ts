const loadModule = () =>
  require('./userVisibleJsWork') as typeof import('./userVisibleJsWork');

describe('user-visible JS work scheduling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for every active task and a quiet window', () => {
    const activity = loadModule();
    const releaseToken = activity.beginUserVisibleJsWork('token-load');
    const releaseProjection =
      activity.beginUserVisibleJsWork('token-projection');
    const callback = jest.fn();

    activity.runAfterUserVisibleJsWorkSettles(callback, { quietMs: 250 });
    jest.runOnlyPendingTimers();
    expect(callback).not.toHaveBeenCalled();

    releaseToken();
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    releaseProjection();
    jest.advanceTimersByTime(249);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('restarts the quiet window when new visible work begins', () => {
    const activity = loadModule();
    const callback = jest.fn();
    const releaseFirst = activity.beginUserVisibleJsWork('first');

    activity.runAfterUserVisibleJsWorkSettles(callback, { quietMs: 200 });
    releaseFirst();
    jest.advanceTimersByTime(150);

    const releaseSecond = activity.beginUserVisibleJsWork('second');
    jest.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();

    releaseSecond();
    jest.advanceTimersByTime(199);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('supports cancelling a pending waiter', () => {
    const activity = loadModule();
    const release = activity.beginUserVisibleJsWork('token-load');
    const callback = jest.fn();
    const cancel = activity.runAfterUserVisibleJsWorkSettles(callback, {
      quietMs: 100,
    });

    cancel();
    release();
    jest.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  it('resolves promise waiters after visible work and the quiet window', async () => {
    const activity = loadModule();
    const release = activity.beginUserVisibleJsWork('token-load');
    const resolved = jest.fn();

    void activity
      .waitForUserVisibleJsWorkToSettle({ quietMs: 100 })
      .then(resolved);

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();

    release();
    jest.advanceTimersByTime(99);
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it('publishes active work snapshots and stops after unsubscribe', () => {
    const activity = loadModule();
    const listener = jest.fn();
    const unsubscribe = activity.subscribeUserVisibleJsWork(listener);

    expect(listener).toHaveBeenLastCalledWith({
      activeCount: 0,
      labels: [],
      lastSettledAt: 0,
    });

    const releaseToken = activity.beginUserVisibleJsWork('token-load');
    const releaseDefi = activity.beginUserVisibleJsWork('defi-load');
    expect(listener).toHaveBeenLastCalledWith({
      activeCount: 2,
      labels: ['token-load', 'defi-load'],
      lastSettledAt: 0,
    });

    releaseToken();
    expect(listener).toHaveBeenLastCalledWith({
      activeCount: 1,
      labels: ['defi-load'],
      lastSettledAt: 0,
    });

    jest.setSystemTime(1_250);
    releaseDefi();
    expect(listener).toHaveBeenLastCalledWith({
      activeCount: 0,
      labels: [],
      lastSettledAt: 1_250,
    });

    unsubscribe();
    const callCount = listener.mock.calls.length;
    activity.beginUserVisibleJsWork('ignored');
    expect(listener).toHaveBeenCalledTimes(callCount);
  });
});
