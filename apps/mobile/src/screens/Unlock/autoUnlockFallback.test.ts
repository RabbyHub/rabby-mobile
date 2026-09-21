import { scheduleAutoUnlockFallback } from './autoUnlockFallback';

describe('scheduleAutoUnlockFallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires once after the deadline when automatic authentication is still eligible', () => {
    const onFallback = jest.fn();
    scheduleAutoUnlockFallback({
      delayMs: 2000,
      shouldFallback: () => true,
      onFallback,
    });

    jest.advanceTimersByTime(1999);
    expect(onFallback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('does not fire when automatic authentication is no longer eligible', () => {
    const onFallback = jest.fn();
    scheduleAutoUnlockFallback({
      delayMs: 2000,
      shouldFallback: () => false,
      onFallback,
    });

    jest.advanceTimersByTime(2000);

    expect(onFallback).not.toHaveBeenCalled();
  });

  it('cancels when the unlock screen loses focus', () => {
    const onFallback = jest.fn();
    const cancel = scheduleAutoUnlockFallback({
      delayMs: 2000,
      shouldFallback: () => true,
      onFallback,
    });

    cancel();
    jest.advanceTimersByTime(2000);

    expect(onFallback).not.toHaveBeenCalled();
  });
});
