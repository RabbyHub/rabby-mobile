/**
 * Non-production store injection for screen-level tests.
 *
 * Two modes, both allowlisted and both gated on `isNonPublicProductionEnv` at
 * the deeplink parser:
 *
 *   store=    one-shot patch applied before navigation
 *   storePin= sticky patch: re-applied whenever the store's own producers write
 *             a different value, so a screen can be held in a state that the
 *             app would otherwise recompute (balances, loading flags, ...)
 *
 * Examples:
 *
 *   ...&store={"tokenList":{"tokenListMap":{"0xabc":[{...ITokenItem}]}}}
 *   ...&storePin={"balanceAccounts":{"totalBalance":123456.78}}
 *   ...&storePinClear=1
 *
 * Only the stores listed here can be written. The allowlist keeps a debug link
 * from mutating wallet/keyring state.
 */
type StatefulStore = {
  setState?: (value: Record<string, unknown>) => void;
  getState?: () => object;
  subscribe?: (listener: () => void) => () => void;
};

type StoreLoader = () => Promise<StatefulStore>;

const STORE_LOADERS: Record<string, { load: StoreLoader; label: string }> = {
  // BaseStore / zustand stores expose `setState(partial)`; only these explicit
  // stores may be written by a debug link.
  account: {
    label: 'account',
    load: async () => (await import('@/store/account')).default,
  },
  // Home balance card + address selection snapshot.
  balanceAccounts: {
    label: 'balanceAccounts',
    load: async () => (await import('@/store/balance')).balanceAccountsStore,
  },
  // Home / TokenDetail token list. `tokenListMap[address] = ITokenItem[]`.
  tokenList: {
    label: 'tokenList',
    load: async () => (await import('@/store/tokens')).default,
  },
  // Derived per-address token index used by the assets tab.
  tokenIndex: {
    label: 'tokenIndex',
    load: async () => (await import('@/store/tokens')).useTokenIndexStore,
  },
  // Per-address balance that the Home card / asset header actually render:
  // `valueMap[address] = { totalBalance, evmBalance, ... }`.
  addressBalance: {
    label: 'addressBalance',
    load: async () => (await import('@/store/balance')).default,
  },
  // Home balance card (scene totals): `combinedData.Home = { netWorth, ... }`.
  scene24hBalance: {
    label: 'scene24hBalance',
    load: async () => (await import('@/store/balance24h')).scene24hBalanceStore,
  },
  // Home 24h curve scenes.
  sceneCurve24h: {
    label: 'sceneCurve24h',
    load: async () => (await import('@/store/curve24h')).sceneCurve24hStore,
  },
};

export function listInjectableStores() {
  return Object.keys(STORE_LOADERS);
}

async function resolveStore(storeId: string) {
  const entry = STORE_LOADERS[storeId];
  if (!entry) {
    console.warn(
      `[screenRegistry] store "${storeId}" is not injectable. Allowed: ${listInjectableStores().join(
        ', ',
      )}`,
    );
    return null;
  }
  const store = await entry.load();
  if (typeof store.setState !== 'function') {
    throw new Error(`${entry.label} store has no setState`);
  }
  return store;
}

function normalizePatch(storeId: string, patch: unknown) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    console.warn(`[screenRegistry] store "${storeId}" expects an object patch`);
    return null;
  }
  return patch as Record<string, unknown>;
}

/** Structural comparison for the JSON values a debug link can carry. */
function sameValue(left: unknown, right: unknown) {
  if (left === right) {
    return true;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export async function applyInjectedStore(storePatch: Record<string, unknown>) {
  for (const [storeId, rawPatch] of Object.entries(storePatch)) {
    const patch = normalizePatch(storeId, rawPatch);
    if (!patch) {
      continue;
    }
    const store = await resolveStore(storeId);
    if (!store) {
      continue;
    }
    store.setState!(patch);
  }
}

type StorePin = {
  storeId: string;
  patch: Record<string, unknown>;
  unsubscribe: () => void;
};

const storePins: StorePin[] = [];

function isPatchApplied(store: StatefulStore, patch: Record<string, unknown>) {
  const state = (store.getState?.() ?? {}) as Record<string, unknown>;
  return Object.keys(patch).every(key => sameValue(state[key], patch[key]));
}

export async function pinInjectedStore(pinPatch: Record<string, unknown>) {
  for (const [storeId, rawPatch] of Object.entries(pinPatch)) {
    const patch = normalizePatch(storeId, rawPatch);
    if (!patch) {
      continue;
    }
    const store = await resolveStore(storeId);
    if (!store) {
      continue;
    }

    clearStorePin(storeId);
    store.setState!(patch);

    let applying = false;
    const unsubscribe = store.subscribe?.(() => {
      if (applying || isPatchApplied(store, patch)) {
        return;
      }
      // A producer wrote a different value; put the pinned fields back. The
      // rest of the store keeps moving, so screens still exercise their real
      // update path around the pinned keys.
      applying = true;
      try {
        store.setState!(patch);
      } finally {
        applying = false;
      }
    });

    storePins.push({
      storeId,
      patch,
      unsubscribe: unsubscribe ?? (() => undefined),
    });
    console.log(
      '[screenRegistry] store pin active',
      storeId,
      Object.keys(patch).join(','),
    );
  }
}

function clearStorePin(storeId: string) {
  for (let index = storePins.length - 1; index >= 0; index -= 1) {
    if (storePins[index].storeId === storeId) {
      storePins[index].unsubscribe();
      storePins.splice(index, 1);
    }
  }
}

export function clearInjectedStorePins() {
  while (storePins.length) {
    const pin = storePins.pop();
    pin?.unsubscribe();
  }
  console.log('[screenRegistry] store pins cleared');
}

export function listInjectedStorePins() {
  return storePins.map(pin => ({
    storeId: pin.storeId,
    keys: Object.keys(pin.patch),
  }));
}
