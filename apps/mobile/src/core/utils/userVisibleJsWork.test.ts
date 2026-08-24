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
});
