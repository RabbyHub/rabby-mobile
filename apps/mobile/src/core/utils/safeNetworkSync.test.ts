import { createSafeNetworkSync } from './safeNetworkSync';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

function setup(
  networks: Record<string, string[]> = { '0xabc': ['1'] },
  supported = ['1', '2'],
  concurrency = 4,
) {
  const keyring = {
    accounts: Object.keys(networks),
    networkIdsMap: { ...networks },
    setNetworkIds(address: string, ids: string[]) {
      this.networkIdsMap = { ...this.networkIdsMap, [address]: ids };
    },
  };
  let current: typeof keyring | undefined = keyring;
  const saved: Array<Record<string, string[]>> = [];
  const dependencies = {
    getKeyring: async () => current,
    getSupportedNetworks: () => supported,
    isSafe: jest.fn(async (_address: string, _network: string) => true),
    persist: jest.fn(async () => {
      saved.push(JSON.parse(JSON.stringify(keyring.networkIdsMap)));
    }),
    publish: jest.fn(),
    concurrency,
  };
  return {
    keyring,
    saved,
    dependencies,
    setCurrent: (value: typeof current) => {
      current = value;
    },
    sync: createSafeNetworkSync(dependencies),
  };
}

describe('Safe network synchronization (unit)', () => {
  it('waits for every account scan and durable completion before resolving bulk sync', async () => {
    const { sync, dependencies, saved, keyring } = setup(
      { '0xabc': [], '0xdef': [] },
      ['1'],
    );
    const slowScan = deferred<boolean>();
    const storage = deferred<void>();
    dependencies.isSafe.mockImplementation(async address =>
      address === '0xabc' ? true : slowScan.promise,
    );
    dependencies.persist.mockImplementation(async () => {
      await storage.promise;
      saved.push(JSON.parse(JSON.stringify(keyring.networkIdsMap)));
    });
    let done = false;
    const pending = sync.syncAll().then(() => {
      done = true;
    });
    await flushMicrotasks();
    expect(done).toBe(false);
    expect(saved).toEqual([]);
    expect(dependencies.persist).not.toHaveBeenCalled();

    slowScan.resolve(true);
    await flushMicrotasks();
    expect(dependencies.persist).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    storage.resolve(undefined);
    await pending;
    expect(saved).toEqual([{ '0xabc': ['1'], '0xdef': ['1'] }]);
  });

  it('removes unsupported chains, preserves existing order, and appends new deployments', async () => {
    const { sync, dependencies, saved } = setup(
      { '0xabc': ['3', '1', '2', '4'] },
      ['2', '3', '5', '6'],
    );
    dependencies.isSafe.mockImplementation(async (_address, network) => {
      if (network === '6') throw new Error('Safe API unavailable');
      return true;
    });
    await expect(sync.syncAddress('0xABC')).resolves.toEqual(['3', '2', '5']);
    expect(
      dependencies.isSafe.mock.calls.map(([, network]) => network),
    ).toEqual(['5', '6']);
    expect(saved).toEqual([{ '0xabc': ['3', '2', '5'] }]);
    expect(dependencies.publish).toHaveBeenCalledWith('0xabc', ['3', '2', '5']);
  });

  it('persists and publishes unsupported-chain removal without probing known supported chains', async () => {
    const { sync, dependencies, saved } = setup({ '0xabc': ['1', '2', '3'] }, [
      '3',
      '1',
    ]);
    await expect(sync.syncAddress('0xabc')).resolves.toEqual(['1', '3']);
    expect(dependencies.isSafe).not.toHaveBeenCalled();
    expect(saved).toEqual([{ '0xabc': ['1', '3'] }]);
    expect(dependencies.publish).toHaveBeenCalledWith('0xabc', ['1', '3']);
  });

  it('retains supported known chains when discovery fails or finds no new Safe', async () => {
    const { sync, dependencies, saved } = setup({ '0xabc': ['1', '2'] }, [
      '1',
      '2',
      '3',
      '4',
    ]);
    dependencies.isSafe.mockImplementation(async (_address, network) => {
      if (network === '3') throw new Error('RPC timeout');
      return false;
    });
    await expect(sync.syncAddress('0xabc')).resolves.toEqual(['1', '2']);
    expect(
      dependencies.isSafe.mock.calls.map(([, network]) => network),
    ).toEqual(['3', '4']);
    expect(saved).toEqual([]);
    expect(dependencies.persist).not.toHaveBeenCalled();
    expect(dependencies.publish).not.toHaveBeenCalled();
  });

  it('clears all known networks without RPC when the support list is empty', async () => {
    const { sync, dependencies, saved } = setup({ '0xabc': ['1', '2'] }, []);
    await expect(sync.syncAddress('0xabc')).resolves.toEqual([]);
    expect(dependencies.isSafe).not.toHaveBeenCalled();
    expect(saved).toEqual([{ '0xabc': [] }]);
    expect(dependencies.publish).toHaveBeenCalledWith('0xabc', []);
  });

  it('does no RPC, persistence, or publication for unchanged supported networks', async () => {
    const { sync, dependencies } = setup({ '0xabc': ['2', '1'] }, ['1', '2']);
    await expect(sync.syncAddress('0xabc')).resolves.toEqual(['2', '1']);
    expect(dependencies.isSafe).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
    expect(dependencies.publish).not.toHaveBeenCalled();
  });

  it('deduplicates overlapping bulk and mixed-case address syncs through persistence', async () => {
    const { sync, dependencies } = setup();
    const probe = deferred<boolean>();
    const storage = deferred<void>();
    dependencies.isSafe.mockReturnValue(probe.promise);
    dependencies.persist.mockReturnValue(storage.promise);
    const all = sync.syncAll();
    const repeatedAll = sync.syncAll();
    const first = sync.syncAddress('0xABC');
    const second = sync.syncAddress('0xabc');
    await flushMicrotasks();
    expect(dependencies.isSafe).toHaveBeenCalledTimes(1);
    probe.resolve(true);
    await flushMicrotasks();
    const duringPersistence = sync.syncAddress('0xABC');
    await flushMicrotasks();
    expect(dependencies.isSafe).toHaveBeenCalledTimes(1);
    expect(dependencies.persist).toHaveBeenCalledTimes(1);
    storage.resolve(undefined);
    await Promise.all([all, repeatedAll]);
    expect(await Promise.all([first, second, duringPersistence])).toEqual([
      ['1', '2'],
      ['1', '2'],
      ['1', '2'],
    ]);
    expect(dependencies.publish).toHaveBeenCalledTimes(1);
  });

  it('limits total network probes across addresses', async () => {
    const { sync, dependencies } = setup(
      { '0xabc': [], '0xdef': [] },
      ['1', '2', '3'],
      2,
    );
    const release = deferred<void>();
    let active = 0;
    let peak = 0;
    dependencies.isSafe.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await release.promise;
      active--;
      return true;
    });
    const pending = sync.syncAll();
    await flushMicrotasks();
    expect(dependencies.isSafe).toHaveBeenCalledTimes(2);
    release.resolve(undefined);
    await pending;
    expect(dependencies.isSafe).toHaveBeenCalledTimes(6);
    expect(peak).toBe(2);
  });

  it.each([true, false])(
    'does not restore or publish a removed account (stale map retained: %s)',
    async retainMap => {
      const { sync, dependencies, keyring } = setup();
      const probe = deferred<boolean>();
      dependencies.isSafe.mockReturnValue(probe.promise);
      const pending = sync.syncAddress('0xabc');
      await flushMicrotasks();
      keyring.accounts = [];
      if (!retainMap) delete keyring.networkIdsMap['0xabc'];
      probe.resolve(true);
      await expect(pending).resolves.toBeUndefined();
      expect(keyring.networkIdsMap['0xabc']).toEqual(
        retainMap ? ['1'] : undefined,
      );
      expect(dependencies.publish).not.toHaveBeenCalled();
      expect(dependencies.persist).not.toHaveBeenCalled();
    },
  );

  it('does not overwrite a reimport that finishes while a scan is pending', async () => {
    const { sync, dependencies, keyring } = setup();
    const probe = deferred<boolean>();
    dependencies.isSafe.mockReturnValue(probe.promise);
    const pending = sync.syncAddress('0xabc');
    await flushMicrotasks();
    keyring.setNetworkIds('0xabc', ['9']);
    probe.resolve(true);
    await expect(pending).resolves.toEqual(['9']);
    expect(dependencies.publish).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('does not apply a scan to an obsolete keyring', async () => {
    const { sync, dependencies, keyring, setCurrent } = setup();
    const probe = deferred<boolean>();
    dependencies.isSafe.mockReturnValue(probe.promise);
    const pending = sync.syncAll();
    await flushMicrotasks();
    setCurrent(undefined);
    probe.resolve(true);
    await pending;
    expect(keyring.networkIdsMap['0xabc']).toEqual(['1']);
    expect(dependencies.publish).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
  });

  it('retries failed persistence even when the next scan has no changes', async () => {
    const { sync, dependencies, saved, keyring } = setup();
    dependencies.persist.mockRejectedValueOnce(new Error('storage failed'));
    await expect(sync.syncAll()).rejects.toThrow('storage failed');
    expect(saved).toEqual([]);
    expect(keyring.networkIdsMap['0xabc']).toEqual(['1', '2']);
    await expect(sync.syncAddress('0xABC')).resolves.toEqual(['1', '2']);
    expect(saved).toEqual([{ '0xabc': ['1', '2'] }]);
    expect(dependencies.persist).toHaveBeenCalledTimes(2);
    expect(dependencies.publish).toHaveBeenCalledTimes(1);
  });

  it('persists a newer revision that arrives during an earlier write', async () => {
    const { sync, dependencies, keyring, saved } = setup(
      { '0xabc': [], '0xdef': [] },
      ['1'],
    );
    const firstWrite = deferred<void>();
    dependencies.persist.mockImplementationOnce(async () => {
      const snapshot = JSON.parse(JSON.stringify(keyring.networkIdsMap));
      await firstWrite.promise;
      saved.push(snapshot);
    });
    const first = sync.syncAddress('0xabc');
    await flushMicrotasks();
    const second = sync.syncAddress('0xdef');
    await flushMicrotasks();
    firstWrite.resolve(undefined);
    await Promise.all([first, second]);
    expect(saved.at(-1)).toEqual({ '0xabc': ['1'], '0xdef': ['1'] });
    expect(dependencies.persist).toHaveBeenCalledTimes(2);
  });

  it('skips orphan maps, accounts without network data, and absent keyrings', async () => {
    const { sync, dependencies, keyring, setCurrent } = setup();
    keyring.accounts = ['0xdef'];
    await sync.syncAll();
    await expect(sync.syncAddress('0xabc')).resolves.toBeUndefined();
    await expect(sync.syncAddress('0xdef')).resolves.toBeUndefined();
    setCurrent(undefined);
    await sync.syncAll();
    await expect(sync.syncAddress('0xabc')).resolves.toBeUndefined();
    expect(dependencies.isSafe).not.toHaveBeenCalled();
    expect(dependencies.publish).not.toHaveBeenCalled();
    expect(dependencies.persist).not.toHaveBeenCalled();
  });
});
