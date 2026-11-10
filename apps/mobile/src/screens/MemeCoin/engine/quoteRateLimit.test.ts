import {
  createRateLimitBackoff,
  createRateLimiter,
  isTooManyRequests,
} from './quoteRateLimit';

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

describe('createRateLimitBackoff', () => {
  const setup = () => {
    const clock = createClock();
    const backoff = createRateLimitBackoff({
      baseMs: 15000,
      maxMs: 60000,
      ...clock,
    });
    return { clock, backoff };
  };

  it('does not wait before anything was rate limited', async () => {
    const { clock, backoff } = setup();
    await backoff.wait();
    expect(clock.sleeps).toEqual([]);
  });

  it('doubles the wait after each 429, up to the cap', async () => {
    const { clock, backoff } = setup();
    for (let i = 0; i < 4; i++) {
      backoff.onRateLimited();
      await backoff.wait();
    }
    expect(clock.sleeps).toEqual([15000, 30000, 60000, 60000]);
  });

  it('counts the wait from the 429, so time already passed is not waited again', async () => {
    const { clock, backoff } = setup();
    backoff.onRateLimited();
    clock.advance(10000);
    await backoff.wait();
    expect(clock.sleeps).toEqual([5000]);
  });

  it('starts over after a success', async () => {
    const { clock, backoff } = setup();
    backoff.onRateLimited();
    backoff.onRateLimited();
    backoff.onSuccess();
    await backoff.wait();
    backoff.onRateLimited();
    await backoff.wait();
    expect(clock.sleeps).toEqual([15000]);
  });
});

describe('isTooManyRequests', () => {
  it('matches an HTTP 429 response', () => {
    expect(isTooManyRequests({ response: { status: 429 } })).toBe(true);
  });

  it.each([{ response: { status: 500 } }, new Error('429'), null, undefined])(
    'ignores anything else: %p',
    error => {
      expect(isTooManyRequests(error)).toBe(false);
    },
  );
});
