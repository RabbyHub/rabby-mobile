type SafeNetworkKeyring = {
  accounts: string[];
  networkIdsMap: Record<string, string[]>;
  setNetworkIds(address: string, networkIds: string[]): void;
};

type SyncDependencies<Keyring extends SafeNetworkKeyring> = {
  getKeyring(): Promise<Keyring | undefined>;
  getSupportedNetworks(): string[];
  isSafe(address: string, networkId: string): Promise<boolean>;
  persist(keyring: Keyring): Promise<unknown>;
  publish(address: string, networkIds: string[]): void;
  concurrency?: number;
};

type SyncState = {
  scans: Map<string, Promise<string[] | undefined>>;
  syncs: Map<string, Promise<string[] | undefined>>;
  all?: Promise<void>;
  revision: number;
  persistedRevision: number;
  persistence?: Promise<void>;
};

/** Prune unsupported networks and discover deployments on unrecorded supported ones. */
export function createSafeNetworkSync<Keyring extends SafeNetworkKeyring>(
  dependencies: SyncDependencies<Keyring>,
) {
  const states = new WeakMap<Keyring, SyncState>();
  const queue: Array<() => void> = [];
  const concurrency = Math.max(1, dependencies.concurrency || 4);
  let active = 0;

  function limit<Result>(task: () => Promise<Result>): Promise<Result> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            active--;
            queue.shift()?.();
          });
      };
      if (active < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  }

  function getState(keyring: Keyring) {
    let state = states.get(keyring);
    if (!state) {
      state = {
        scans: new Map(),
        syncs: new Map(),
        revision: 0,
        persistedRevision: 0,
      };
      states.set(keyring, state);
    }
    return state;
  }

  function readNetworks(keyring: Keyring, address: string) {
    // Removed accounts can still have an entry in networkIdsMap.
    if (!keyring.accounts.some(account => account.toLowerCase() === address)) {
      return undefined;
    }
    return keyring.networkIdsMap[address];
  }

  async function persist(keyring: Keyring, state: SyncState) {
    if (state.persistedRevision === state.revision) {
      return;
    }
    if (!state.persistence) {
      state.persistence = (async () => {
        while (state.persistedRevision < state.revision) {
          if ((await dependencies.getKeyring()) !== keyring) {
            return;
          }
          const revision = state.revision;
          await dependencies.persist(keyring);
          state.persistedRevision = revision;
        }
      })();
      const pending = state.persistence;
      const clear = () => {
        if (state.persistence === pending) state.persistence = undefined;
      };
      void pending.then(clear, clear);
    }
    await state.persistence;
  }

  function scan(keyring: Keyring, address: string, state: SyncState) {
    const previous = state.scans.get(address);
    if (previous) return previous;

    const pending = (async () => {
      const networks = readNetworks(keyring, address);
      if (!networks) return undefined;
      const known = new Set(networks);
      const supported = new Set(dependencies.getSupportedNetworks());
      const retained = Array.from(known).filter(network =>
        supported.has(network),
      );
      const candidates = Array.from(supported).filter(
        network => !known.has(network),
      );
      const deployed = await Promise.all(
        candidates.map(networkId =>
          limit(async () => {
            try {
              return await dependencies.isSafe(address, networkId);
            } catch {
              return false;
            }
          }),
        ),
      );
      if ((await dependencies.getKeyring()) !== keyring) return undefined;
      const current = readNetworks(keyring, address);
      // Do not overwrite an account removed or reimported during the scan.
      if (current !== networks) return current;
      const next = retained.concat(
        candidates.filter((_, index) => deployed[index]),
      );
      if (
        next.length !== networks.length ||
        next.some((network, index) => network !== networks[index])
      ) {
        keyring.setNetworkIds(address, next);
        state.revision++;
        dependencies.publish(address, next);
      }
      return readNetworks(keyring, address);
    })();
    state.scans.set(address, pending);
    return pending;
  }

  async function syncAddress(address: string) {
    const keyring = await dependencies.getKeyring();
    if (!keyring) return undefined;
    address = address.toLowerCase();
    const state = getState(keyring);
    const previous = state.syncs.get(address);
    if (previous) return previous;
    const pending = (async () => {
      await scan(keyring, address, state);
      await persist(keyring, state);
      if ((await dependencies.getKeyring()) !== keyring) return undefined;
      return readNetworks(keyring, address);
    })();
    state.syncs.set(address, pending);
    try {
      return await pending;
    } finally {
      state.syncs.delete(address);
      if (!state.all) state.scans.delete(address);
    }
  }

  async function syncAll() {
    const keyring = await dependencies.getKeyring();
    if (!keyring) return;
    const state = getState(keyring);
    if (state.all) return state.all;
    state.all = (async () => {
      const results = await Promise.allSettled(
        Array.from(
          new Set(keyring.accounts.map(item => item.toLowerCase())),
        ).map(address => scan(keyring, address, state)),
      );
      await persist(keyring, state);
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    })();
    try {
      await state.all;
    } finally {
      state.all = undefined;
      state.scans.clear();
    }
  }

  return { syncAddress, syncAll };
}
