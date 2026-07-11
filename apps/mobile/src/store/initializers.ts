import { runStartupDiagnosticTask } from '@/core/utils/startupDiagnostics';

import { useAppChainStore } from './appchain';
import addressBalanceStore from './balance';
import {
  balance24hStore,
  hydrateCachedHome24hBalanceScene,
} from './balance24h';
import { hydrateCachedHomeDayCurve, initCurve24hStore } from './curve24h';

type StoreInitializerPhase =
  | 'boot-readable-account'
  | 'readable-account-heavy'
  | 'home-scene-hydrate';

type StoreInitializerRegistration = {
  id: string;
  phase: StoreInitializerPhase;
  run: () => void | Promise<void>;
};

type StoreInitializerState = {
  promise: Promise<void> | null;
};

export type ReadableAccountHeavyStoreTarget =
  | 'token'
  | 'nft'
  | 'protocol'
  | 'all';

const storeInitializers = new Map<string, StoreInitializerRegistration>();
const storeInitializerStates = new Map<string, StoreInitializerState>();

function registerStoreInitializer(registration: StoreInitializerRegistration) {
  const existing = storeInitializers.get(registration.id);
  if (existing && existing !== registration && __DEV__) {
    console.warn(
      `[storeInitializers] overriding registered initializer: ${registration.id}`,
    );
  }

  storeInitializers.set(registration.id, registration);
}

function getStoreInitializerState(id: string) {
  let state = storeInitializerStates.get(id);
  if (!state) {
    state = { promise: null };
    storeInitializerStates.set(id, state);
  }
  return state;
}

function ensureStoreInitializer(id: string) {
  const registration = storeInitializers.get(id);
  if (!registration) {
    throw new Error(`Store initializer is not registered: ${id}`);
  }

  const state = getStoreInitializerState(id);
  if (state.promise) {
    return state.promise;
  }

  const promise = runStartupDiagnosticTask(
    `storeInitializer.${registration.id}`,
    {
      phase: registration.phase,
    },
    async () => {
      await registration.run();
    },
  ).catch(error => {
    state.promise = null;
    throw error;
  });

  state.promise = promise;
  return promise;
}

async function runStoreInitializerSteps(steps: readonly string[][]) {
  for (const step of steps) {
    await Promise.all(step.map(id => ensureStoreInitializer(id)));
  }
}

registerStoreInitializer({
  id: 'appChainStore.initStore',
  phase: 'boot-readable-account',
  run: () => useAppChainStore.getState().initStore(),
});

registerStoreInitializer({
  id: 'addressBalanceStore.initStore',
  phase: 'boot-readable-account',
  run: () => addressBalanceStore.initStore(),
});

registerStoreInitializer({
  id: 'balance24hStore.initStore',
  phase: 'boot-readable-account',
  run: () => balance24hStore.initStore(),
});

registerStoreInitializer({
  id: 'initCurve24hStore',
  phase: 'boot-readable-account',
  run: () => initCurve24hStore(),
});

registerStoreInitializer({
  id: 'hydrateCachedHome24hBalanceScene',
  phase: 'home-scene-hydrate',
  run: () => hydrateCachedHome24hBalanceScene(),
});

registerStoreInitializer({
  id: 'hydrateCachedHomeDayCurve',
  phase: 'home-scene-hydrate',
  run: () => hydrateCachedHomeDayCurve(),
});

registerStoreInitializer({
  id: 'tokenListStore.initStore',
  phase: 'readable-account-heavy',
  run: async () => {
    const { default: tokenListStore } = await import('./tokens');
    await tokenListStore.getState().initStore();
  },
});

registerStoreInitializer({
  id: 'nftListStore.initStore',
  phase: 'readable-account-heavy',
  run: async () => {
    const { default: nftListStore } = await import('./nfts');
    await nftListStore.getState().initStore();
  },
});

registerStoreInitializer({
  id: 'protocolListStore.initStore',
  phase: 'readable-account-heavy',
  run: async () => {
    const { default: useProtocolListStore } = await import('./protocols');
    await useProtocolListStore.getState().initStore();
  },
});

export async function startReadableAccountBootStoreInitializers() {
  await runStoreInitializerSteps([
    ['appChainStore.initStore'],
    [
      'addressBalanceStore.initStore',
      'balance24hStore.initStore',
      'initCurve24hStore',
    ],
  ]);
}

export async function startHomeSceneCacheHydrateInitializers() {
  await runStoreInitializerSteps([
    ['hydrateCachedHome24hBalanceScene', 'hydrateCachedHomeDayCurve'],
  ]);
}

export async function startReadableAccountHeavyStoreInitializers() {
  await runStoreInitializerSteps([
    ['tokenListStore.initStore'],
    ['nftListStore.initStore'],
    ['protocolListStore.initStore'],
  ]);
}

export async function startReadableAccountHeavyStoreInitializer(
  target: ReadableAccountHeavyStoreTarget,
) {
  if (target === 'all') {
    await startReadableAccountHeavyStoreInitializers();
    return;
  }

  const targetToInitializerId: Record<
    Exclude<ReadableAccountHeavyStoreTarget, 'all'>,
    string
  > = {
    token: 'tokenListStore.initStore',
    nft: 'nftListStore.initStore',
    protocol: 'protocolListStore.initStore',
  };

  await ensureStoreInitializer(targetToInitializerId[target]);
}

export { ensureStoreInitializer };
