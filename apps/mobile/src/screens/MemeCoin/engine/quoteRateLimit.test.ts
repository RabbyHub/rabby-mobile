import { createRateLimiter } from './quoteRateLimit';

const createClock = () => {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
    sleeps,
  };
};

describe('createRateLimiter', () => {
  it('runs up to the limit at once, then waits for the oldest to leave the window', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, ...clock });
    const startedAt: number[] = [];
    await Promise.all(
      [0, 1, 2].map(() =>
        limiter.schedule(async () => {
          startedAt.push(clock.now());
        }),
      ),
    );
    expect(startedAt).toEqual([0, 0, 1000]);
    expect(clock.sleeps).toEqual([1000]);
  });

  it('starts tasks in the order they were scheduled', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, ...clock });
    const order: string[] = [];
    await Promise.all(
      ['a', 'b', 'c'].map(name =>
        limiter.schedule(async () => {
          order.push(name);
        }),
      ),
    );
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('does not wait once the window has passed', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, ...clock });
    await limiter.schedule(async () => undefined);
    clock.advance(1000);
    await limiter.schedule(async () => undefined);
    expect(clock.sleeps).toEqual([]);
  });

  it('keeps going after a task fails', async () => {
    const clock = createClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, ...clock });
    await expect(
      limiter.schedule(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(limiter.schedule(async () => 'ok')).resolves.toBe('ok');
  });
});
