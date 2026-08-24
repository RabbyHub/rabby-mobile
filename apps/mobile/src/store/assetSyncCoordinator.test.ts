import {
  AssetSyncCoordinator,
  buildAssetSyncScopeKey,
} from './assetSyncCoordinator';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('AssetSyncCoordinator', () => {
  it('builds one stable scope for equivalent address sets', () => {
    expect(
      buildAssetSyncScopeKey({
        kind: 'token',
        variant: 'multi-address',
        addresses: ['0xB', '0xa', '0xA'],
      }),
    ).toBe('token:multi-address:0xa|0xb');
  });

  it('shares one in-flight request and promotes its trigger and force intent', async () => {
    const coordinator = new AssetSyncCoordinator();
    const execution = deferred<string>();
    const execute = jest.fn(async ticket => {
      expect(ticket.getTrigger()).toBe('pull-refresh');
      expect(ticket.isForceRequested()).toBe(true);
      return execution.promise;
    });
    const scope = {
      kind: 'token',
      variant: 'multi-address',
      addresses: ['0xa'],
    };

    const initial = coordinator.run({
      scope,
      trigger: 'initial',
      force: false,
      execute,
    });
    const manual = coordinator.run({
      scope,
      trigger: 'pull-refresh',
      force: true,
      execute,
    });

    expect(initial).toBe(manual);
    execution.resolve('done');
    await expect(initial).resolves.toBe('done');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not merge different execution variants', async () => {
    const coordinator = new AssetSyncCoordinator();
    const execute = jest.fn(async ticket => ticket.scopeKey);

    const [single, multi] = await Promise.all([
      coordinator.run({
        scope: {
          kind: 'token',
          variant: 'single-address',
          addresses: ['0xa'],
        },
        trigger: 'initial',
        force: false,
        execute,
      }),
      coordinator.run({
        scope: {
          kind: 'token',
          variant: 'multi-address',
          addresses: ['0xa'],
        },
        trigger: 'initial',
        force: false,
        execute,
      }),
    ]);

    expect(single).not.toBe(multi);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('reports a failed execution through the same lifecycle ticket', async () => {
    const coordinator = new AssetSyncCoordinator();
    const onStart = jest.fn();
    const onError = jest.fn();
    const error = new Error('offline');

    await expect(
      coordinator.run({
        scope: { kind: 'token', addresses: ['0xa'] },
        trigger: 'resume',
        force: false,
        onStart,
        onError,
        execute: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(onStart.mock.calls[0][0], error);
  });
});
