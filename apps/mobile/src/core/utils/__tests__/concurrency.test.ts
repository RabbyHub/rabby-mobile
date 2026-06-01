import {
  makeAvoidParallelAsyncFunc,
  makeAvoidParallelFunc,
  makeSWRKeyAsyncFunc,
} from '../concurrency';

describe('core concurrency utils', () => {
  it('prevents re-entrant sync calls and allows later calls after completion', () => {
    let calls = 0;
    let wrapped: () => void;

    wrapped = makeAvoidParallelFunc(() => {
      calls += 1;
      wrapped();
    });

    wrapped();
    wrapped();

    expect(calls).toBe(2);
  });

  it('resets sync execution state and rethrows errors', () => {
    const error = new Error('boom');
    const fn = jest
      .fn()
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockImplementationOnce(() => 'ok');
    const wrapped = makeAvoidParallelFunc(fn);

    expect(() => wrapped()).toThrow(error);
    expect(() => wrapped()).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight async call and resets after it resolves', async () => {
    let resolveFirst: (value: string) => void = jest.fn();
    const fn = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce('second');
    const wrapped = makeAvoidParallelAsyncFunc(fn);

    const p1 = wrapped('first');
    const p2 = wrapped('ignored');
    expect(fn).toHaveBeenCalledTimes(1);

    resolveFirst('first-result');
    await expect(Promise.all([p1, p2])).resolves.toEqual([
      'first-result',
      'first-result',
    ]);

    await expect(wrapped('second')).resolves.toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('resets async execution state and rethrows errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('async boom'))
      .mockResolvedValueOnce('ok');
    const wrapped = makeAvoidParallelAsyncFunc(fn);

    await expect(wrapped()).rejects.toThrow('async boom');
    await expect(wrapped()).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deduplicates async calls by static SWR key', async () => {
    let resolveFirst: (value: string) => void = jest.fn();
    const fn = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce('second');
    const wrapped = makeSWRKeyAsyncFunc(fn, 'static-key');

    const p1 = wrapped('a');
    const p2 = wrapped('b');
    expect(fn).toHaveBeenCalledTimes(1);

    resolveFirst('first');
    await expect(Promise.all([p1, p2])).resolves.toEqual(['first', 'first']);

    await expect(wrapped('c')).resolves.toBe('second');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deduplicates async calls by computed SWR key', async () => {
    const fn = jest.fn(async (scope: string, id: string) => `${scope}:${id}`);
    const wrapped = makeSWRKeyAsyncFunc(fn, ({ args }) => args);

    await expect(
      Promise.all([wrapped('wallet', '1'), wrapped('wallet', '1')]),
    ).resolves.toEqual(['wallet:1', 'wallet:1']);
    await wrapped('wallet', '2');

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
