import { createTokenLoadCoordinator } from './tokenLoadCoordinator';

const createDeferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('token load coordinator', () => {
  it('deduplicates concurrent loads but allows a later explicit refresh', async () => {
    const coordinator = createTokenLoadCoordinator();
    const deferred = createDeferred();
    const task = jest.fn(() => deferred.promise);

    const first = coordinator.load('0x1::eth', task);
    const second = coordinator.load('0x1::eth', task);

    expect(first).toBe(second);
    expect(task).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await first;
    await coordinator.load('0x1::eth', task);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('runs an initial load again after switching away from and back to a key', async () => {
    const coordinator = createTokenLoadCoordinator();
    const task = jest.fn(async () => undefined);

    await coordinator.ensureInitial('0x1::eth', task);
    await coordinator.ensureInitial('0x1::eth', task);
    await coordinator.ensureInitial('0x2::eth', task);
    await coordinator.ensureInitial('0x1::eth', task);

    expect(task).toHaveBeenCalledTimes(3);
  });

  it('allows the initial load to retry after a failure', async () => {
    const coordinator = createTokenLoadCoordinator();
    const task = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(coordinator.ensureInitial('0x1::eth', task)).rejects.toThrow(
      'network unavailable',
    );
    await expect(
      coordinator.ensureInitial('0x1::eth', task),
    ).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
