import {
  buildHomeProjectionSyncPlan,
  createHomeProjectionScheduler,
} from './scheduler';

describe('home portfolio projection scheduler', () => {
  it('expands account invalidation to every dependent projection', () => {
    expect(buildHomeProjectionSyncPlan(['account'])).toEqual({
      account: true,
      balance: true,
      change24h: true,
      curve: true,
    });
  });

  it('keeps resource invalidations scoped to their projection domains', () => {
    expect(buildHomeProjectionSyncPlan(['balance', 'change24h'])).toEqual({
      account: false,
      balance: true,
      change24h: true,
      curve: false,
    });
  });

  it('coalesces a source update burst into one ordered sync plan', () => {
    let currentTime = 1_000;
    const timers: Array<() => void> = [];
    const frames: Array<() => void> = [];
    const onFlush = jest.fn();
    const scheduler = createHomeProjectionScheduler({
      onFlush,
      minIntervalMs: 120,
      now: () => currentTime,
      scheduleTimer: callback => {
        timers.push(callback);
      },
      scheduleFrame: callback => {
        frames.push(callback);
      },
    });

    scheduler.flushNow('account');
    onFlush.mockClear();

    currentTime += 10;
    scheduler.schedule('balance');
    scheduler.schedule('change24h');
    scheduler.schedule('balance');
    scheduler.schedule('curve');

    expect(timers).toHaveLength(1);
    expect(frames).toHaveLength(0);
    expect(onFlush).not.toHaveBeenCalled();

    currentTime += 110;
    timers[0]();
    expect(frames).toHaveLength(1);

    frames[0]();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith({
      account: false,
      balance: true,
      change24h: true,
      curve: true,
    });
  });
});
