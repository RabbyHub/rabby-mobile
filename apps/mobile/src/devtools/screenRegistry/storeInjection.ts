/**
 * Non-production store injection for screen-level tests.
 *
 * A test can seed a screen's data dependency before it mounts:
 *
 *   debug-open-screen&screen=TokenDetail&store={"homePortfolio":{...}}
 *
 * Only the stores listed here can be written. The allowlist keeps a debug link
 * from mutating wallet/keyring state, and the deep link itself is gated on
 * `isNonPublicProductionEnv` at the parser.
 */
type StoreApplier = (patch: Record<string, unknown>) => Promise<void> | void;

type StatefulStore = {
  setState?: (value: Record<string, unknown>) => void;
};

function makeStoreApplier(
  load: () => Promise<StatefulStore>,
  label: string,
): StoreApplier {
  return async patch => {
    const store = await load();
    if (typeof store.setState !== 'function') {
      throw new Error(`${label} store has no setState`);
    }
    store.setState(patch);
  };
}

const STORE_APPLIERS: Record<string, StoreApplier> = {
  // BaseStore subclasses expose `setState(partial)`; only these explicit
  // stores may be written by a debug link.
  account: makeStoreApplier(
    async () => (await import('@/store/account')).default,
    'account',
  ),
};

export function listInjectableStores() {
  return Object.keys(STORE_APPLIERS);
}

export async function applyInjectedStore(storePatch: Record<string, unknown>) {
  for (const [storeId, patch] of Object.entries(storePatch)) {
    const apply = STORE_APPLIERS[storeId];
    if (!apply) {
      console.warn(
        `[screenRegistry] store "${storeId}" is not injectable. Allowed: ${listInjectableStores().join(
          ', ',
        )}`,
      );
      continue;
    }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      console.warn(
        `[screenRegistry] store "${storeId}" expects an object patch`,
      );
      continue;
    }
    await apply(patch as Record<string, unknown>);
  }
}
