import { cached } from './cache';

describe('cached', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses the cached value for the same key before expiration', async () => {
    const fn = jest.fn(async (value: number) => value);
    const wrapped = cached(fn, 1000);

    jest.spyOn(Date, 'now').mockReturnValue(1000);
    await expect(wrapped([1], 'same-key', false)).resolves.toBe(1);

    jest.spyOn(Date, 'now').mockReturnValue(1500);
    await expect(wrapped([999], 'same-key', false)).resolves.toBe(1);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('refreshes the cache after the ttl expires', async () => {
    const fn = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const wrapped = cached(fn, 1000);

    jest.spyOn(Date, 'now').mockReturnValue(1000);
    await expect(wrapped(['a'], 'expiring-key', false)).resolves.toBe('first');

    jest.spyOn(Date, 'now').mockReturnValue(2001);
    await expect(wrapped(['b'], 'expiring-key', false)).resolves.toBe('second');

    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
  });

  it('bypasses an unexpired cache entry when force is true', async () => {
    const fn = jest
      .fn<Promise<number>, [number]>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const wrapped = cached(fn, 1000);

    jest.spyOn(Date, 'now').mockReturnValue(1000);
    await expect(wrapped([1], 'forced-key', false)).resolves.toBe(1);

    jest.spyOn(Date, 'now').mockReturnValue(1200);
    await expect(wrapped([2], 'forced-key', true)).resolves.toBe(2);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
