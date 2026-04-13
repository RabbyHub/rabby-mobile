import { sleep } from './async';

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves after the requested delay', async () => {
    const spy = jest.fn();
    const pending = sleep(50).then(spy);

    jest.advanceTimersByTime(49);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await pending;

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('defaults to an immediate timeout when no delay is passed', async () => {
    const spy = jest.fn();
    const pending = sleep().then(spy);

    jest.runOnlyPendingTimers();
    await pending;

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
