import { createStore } from 'jotai/vanilla';

import { createRaceSafeHydratedAtom } from './raceSafeHydratedAtom';

describe('createRaceSafeHydratedAtom', () => {
  it('does not let late hydration overwrite a user update', async () => {
    let resolveHydration: ((value: string) => void) | undefined;
    let resolveCommit: ((value: string) => void) | undefined;
    const hydratedAtom = createRaceSafeHydratedAtom({
      initialValue: 'default',
      hydrate: () =>
        new Promise<string>(resolve => {
          resolveHydration = resolve;
        }),
      commitUpdate: (_previous, update: string) =>
        new Promise<string>(resolve => {
          resolveCommit = () => resolve(update);
        }),
    });
    const store = createStore();
    const unsubscribe = store.sub(hydratedAtom, () => undefined);

    await Promise.resolve();
    const update = store.set(hydratedAtom, 'user-value');
    expect(store.get(hydratedAtom)).toBe('default');

    resolveHydration?.('persisted-value');
    await Promise.resolve();
    expect(store.get(hydratedAtom)).toBe('default');

    resolveCommit?.('user-value');
    await update;
    expect(store.get(hydratedAtom)).toBe('user-value');
    unsubscribe();
  });

  it('rolls back the latest optimistic update when persistence fails', async () => {
    const hydratedAtom = createRaceSafeHydratedAtom({
      initialValue: 'persisted-value',
      hydrate: async () => 'persisted-value',
      optimisticUpdate: (_previous, update: string) => update,
      commitUpdate: async () => {
        throw new Error('write failed');
      },
    });
    const store = createStore();

    const update = store.set(hydratedAtom, 'user-value');
    expect(store.get(hydratedAtom)).toBe('user-value');
    await expect(update).rejects.toThrow('write failed');
    expect(store.get(hydratedAtom)).toBe('persisted-value');
  });

  it('does not let a stale post-persist read overwrite a newer update', async () => {
    let resolveFirstCommit: ((value: string) => void) | undefined;
    let commitCount = 0;
    const hydratedAtom = createRaceSafeHydratedAtom({
      initialValue: 'persisted-value',
      hydrate: async () => 'persisted-value',
      commitUpdate: (_previous, update: string) => {
        commitCount += 1;
        if (commitCount === 1) {
          return new Promise<string>(resolve => {
            resolveFirstCommit = resolve;
          });
        }
        return Promise.resolve(update);
      },
    });
    const store = createStore();

    const firstUpdate = store.set(hydratedAtom, 'first-value');
    expect(resolveFirstCommit).toBeDefined();

    await store.set(hydratedAtom, 'second-value');
    expect(store.get(hydratedAtom)).toBe('second-value');

    resolveFirstCommit?.('stale-first-value');
    await firstUpdate;
    expect(store.get(hydratedAtom)).toBe('second-value');
  });
});
