import type { Account } from '@/core/startupServices/preference';

export type PerpsRuntimeIdentity = string;

export type PerpsRuntimeStatus =
  | 'waitingForAccount'
  | 'initializing'
  | 'ready'
  | 'error';

export type PerpsRuntimePhase = 'signer' | 'login' | 'baseline' | null;

export type PerpsRuntimeBranch =
  | 'selfSign'
  | 'lockedAgent'
  | 'unlockedAgent'
  | null;

export type PerpsRuntimeOrigin = 'runtime' | 'external' | null;

export type PerpsRuntimeSnapshot = {
  status: PerpsRuntimeStatus;
  phase: PerpsRuntimePhase;
  branch: PerpsRuntimeBranch;
  identity: PerpsRuntimeIdentity | null;
  generation: number;
  origin: PerpsRuntimeOrigin;
  error: unknown | null;
};

type Listener = () => void;

let generationSequence = 0;
let snapshot: PerpsRuntimeSnapshot = {
  status: 'waitingForAccount',
  phase: null,
  branch: null,
  identity: null,
  generation: generationSequence,
  origin: null,
  error: null,
};

const listeners = new Set<Listener>();

const publishSnapshot = (nextSnapshot: PerpsRuntimeSnapshot) => {
  snapshot = nextSnapshot;
  listeners.forEach(listener => listener());
};

const allocateGeneration = () => {
  generationSequence += 1;
  return generationSequence;
};

export const getPerpsRuntimeIdentity = (
  account: Pick<Account, 'address' | 'type'>,
): PerpsRuntimeIdentity =>
  `${account.address.toLowerCase()}::${String(account.type)}`;

export const getPerpsRuntimeSnapshot = () => snapshot;

export const subscribePerpsRuntime = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const beginPerpsRuntimeGeneration = (
  identity: PerpsRuntimeIdentity,
  branch: Exclude<PerpsRuntimeBranch, null>,
) => {
  const generation = allocateGeneration();
  publishSnapshot({
    status: 'initializing',
    phase: 'signer',
    branch,
    identity,
    generation,
    origin: 'runtime',
    error: null,
  });
  return generation;
};

export const adoptExternalPerpsRuntime = (identity: PerpsRuntimeIdentity) => {
  const generation = allocateGeneration();
  publishSnapshot({
    status: 'ready',
    phase: null,
    branch: null,
    identity,
    generation,
    origin: 'external',
    error: null,
  });
  return generation;
};

export const setPerpsRuntimeWaitingForAccount = () => {
  if (snapshot.status === 'waitingForAccount' && snapshot.identity === null) {
    return snapshot.generation;
  }

  const generation = allocateGeneration();
  publishSnapshot({
    status: 'waitingForAccount',
    phase: null,
    branch: null,
    identity: null,
    generation,
    origin: null,
    error: null,
  });
  return generation;
};

export const isPerpsRuntimeGenerationCurrent = (
  generation: number,
  identity: PerpsRuntimeIdentity,
) =>
  snapshot.generation === generation &&
  snapshot.identity === identity &&
  snapshot.origin === 'runtime';

export const setPerpsRuntimePhase = (
  generation: number,
  identity: PerpsRuntimeIdentity,
  phase: Exclude<PerpsRuntimePhase, null>,
) => {
  if (!isPerpsRuntimeGenerationCurrent(generation, identity)) {
    return false;
  }

  publishSnapshot({
    ...snapshot,
    status: 'initializing',
    phase,
    error: null,
  });
  return true;
};

export const setPerpsRuntimeReady = (
  generation: number,
  identity: PerpsRuntimeIdentity,
) => {
  if (!isPerpsRuntimeGenerationCurrent(generation, identity)) {
    return false;
  }

  publishSnapshot({
    ...snapshot,
    status: 'ready',
    phase: null,
    error: null,
  });
  return true;
};

export const setPerpsRuntimeError = (
  generation: number,
  identity: PerpsRuntimeIdentity,
  phase: Exclude<PerpsRuntimePhase, null>,
  error: unknown,
) => {
  if (!isPerpsRuntimeGenerationCurrent(generation, identity)) {
    return false;
  }

  publishSnapshot({
    ...snapshot,
    status: 'error',
    phase,
    error,
  });
  return true;
};

export const resetPerpsRuntimeStateForTests = () => {
  const generation = allocateGeneration();
  publishSnapshot({
    status: 'waitingForAccount',
    phase: null,
    branch: null,
    identity: null,
    generation,
    origin: null,
    error: null,
  });
};
