function loadPollModule() {
  jest.resetModules();

  jest.doMock(
    'viem/_types/errors/utils',
    () => ({
      ErrorType: class ErrorType {},
    }),
    {
      virtual: true,
    },
  );

  return require('./poll') as typeof import('./poll');
}

describe('poll', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits immediately when emitOnBegin is enabled and passes the first result to initialWaitTime', async () => {
    const { poll } = loadPollModule();
    const calls: string[] = [];
    const initialWaitTime = jest.fn(async data => {
      calls.push(`wait:${data}`);
      return 5;
    });

    poll(
      async ({ unpoll }) => {
        calls.push(`fn:${calls.length}`);
        if (calls.includes('fn:2')) {
          unpoll();
        }
        return 'seed';
      },
      {
        emitOnBegin: true,
        initialWaitTime,
        interval: 10,
      },
    );

    await Promise.resolve();
    expect(calls).toEqual(['fn:0', 'wait:seed']);

    await jest.advanceTimersByTimeAsync(5);
    expect(calls).toContain('fn:2');

    await jest.advanceTimersByTimeAsync(100);
    expect(calls.filter(item => item.startsWith('fn:')).length).toBe(2);
  });

  it('waits for the interval before the first call when emitOnBegin is disabled', async () => {
    const { poll } = loadPollModule();
    const fn = jest.fn(async ({ unpoll }: { unpoll: () => void }) => {
      unpoll();
    });

    poll(fn, {
      interval: 10,
    });

    await Promise.resolve();
    expect(fn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(9);
    expect(fn).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops polling when the returned unwatch function is called', async () => {
    const { poll } = loadPollModule();
    const fn = jest.fn(async () => undefined);

    const unwatch = poll(fn, {
      emitOnBegin: true,
      interval: 10,
    });

    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);

    unwatch();
    await jest.advanceTimersByTimeAsync(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
