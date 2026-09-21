import { AddressBatchRefreshCoordinator } from './addressBatchRefreshCoordinator';

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe('AddressBatchRefreshCoordinator', () => {
  it('joins an equivalent address scope and promotes it to force refresh', async () => {
    const coordinator = new AddressBatchRefreshCoordinator();
    const pending = deferred<void>();
    let observedForceRequested = false;
    const execute = jest.fn(async ticket => {
      await pending.promise;
      observedForceRequested = ticket.isForceRequested();
    });

    const first = coordinator.run(['0xA', '0xB'], false, execute);
    const second = coordinator.run(['0xb', '0xa'], true, execute);
    pending.resolve();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(observedForceRequested).toBe(true);
  });

  it('does not join a different address scope', async () => {
    const coordinator = new AddressBatchRefreshCoordinator();
    const execute = jest.fn(async () => {});

    await Promise.all([
      coordinator.run(['0xA'], false, execute),
      coordinator.run(['0xB'], false, execute),
    ]);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('promotes a projection-only flight when a full snapshot consumer joins', async () => {
    const coordinator = new AddressBatchRefreshCoordinator();
    const pending = deferred<void>();
    let observedFullSnapshotRequested = false;
    const execute = jest.fn(async ticket => {
      await pending.promise;
      observedFullSnapshotRequested = ticket.isFullSnapshotRequested();
    });

    const projection = coordinator.run(['0xA'], false, execute, {
      allowProjectionOnly: true,
    });
    const fullSnapshot = coordinator.run(['0xa'], false, execute);
    pending.resolve();

    await Promise.all([projection, fullSnapshot]);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(observedFullSnapshotRequested).toBe(true);
  });
});
