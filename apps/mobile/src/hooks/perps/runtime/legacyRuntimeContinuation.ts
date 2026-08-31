import type {
  PerpsRuntimeBranch,
  PerpsRuntimeIdentity,
  PerpsRuntimeOrigin,
} from './perpsRuntimeState';

type RuntimeBranch = Exclude<PerpsRuntimeBranch, null>;

export type LegacyRuntimeContinuationHandlers = {
  selfSign: () => void | Promise<void>;
  lockedAgent: (agentAddress: string) => void | Promise<void>;
  unlockedAgent: (agentAddress: string) => void | Promise<void>;
};

type LegacyRuntimeContinuationRequest = {
  generation: number;
  identity: PerpsRuntimeIdentity;
  branch: RuntimeBranch;
  agentAddress?: string;
};

type RegisteredAdapter = {
  identity: PerpsRuntimeIdentity;
  handlers: LegacyRuntimeContinuationHandlers;
};

let adapterSequence = 0;
let activeGeneration: number | null = null;
let activeIdentity: PerpsRuntimeIdentity | null = null;
let activeOrigin: PerpsRuntimeOrigin = null;
let pendingRequest: LegacyRuntimeContinuationRequest | null = null;

const claimedGenerations = new Set<number>();
const adapters = new Map<number, RegisteredAdapter>();

const getMatchingAdapter = (identity: PerpsRuntimeIdentity) =>
  Array.from(adapters.values()).find(
    adapter => adapter.identity === identity,
  ) ?? null;

const invokeContinuation = (
  request: LegacyRuntimeContinuationRequest,
  adapter: RegisteredAdapter,
) => {
  claimedGenerations.add(request.generation);
  pendingRequest = null;

  let result: void | Promise<void>;
  try {
    if (request.branch === 'selfSign') {
      result = adapter.handlers.selfSign();
    } else if (request.branch === 'lockedAgent') {
      result = adapter.handlers.lockedAgent(request.agentAddress ?? '');
    } else {
      result = adapter.handlers.unlockedAgent(request.agentAddress ?? '');
    }
  } catch (error) {
    console.error('[perpsRuntime] legacy continuation failed', error);
    return;
  }

  Promise.resolve(result).catch(error => {
    console.error('[perpsRuntime] legacy continuation failed', error);
  });
};

const tryFlushPendingRequest = () => {
  const request = pendingRequest;
  if (
    !request ||
    activeOrigin !== 'runtime' ||
    request.generation !== activeGeneration ||
    request.identity !== activeIdentity ||
    claimedGenerations.has(request.generation)
  ) {
    return;
  }

  const adapter = getMatchingAdapter(request.identity);
  if (adapter) {
    invokeContinuation(request, adapter);
  }
};

export const prepareLegacyRuntimeContinuation = ({
  generation,
  identity,
  origin,
}: {
  generation: number;
  identity: PerpsRuntimeIdentity | null;
  origin: PerpsRuntimeOrigin;
}) => {
  activeGeneration = generation;
  activeIdentity = identity;
  activeOrigin = origin;
  pendingRequest = null;

  claimedGenerations.forEach(claimedGeneration => {
    if (claimedGeneration < generation) {
      claimedGenerations.delete(claimedGeneration);
    }
  });
};

export const requestLegacyRuntimeContinuation = (
  request: LegacyRuntimeContinuationRequest,
) => {
  if (
    activeOrigin !== 'runtime' ||
    request.generation !== activeGeneration ||
    request.identity !== activeIdentity ||
    claimedGenerations.has(request.generation)
  ) {
    return false;
  }

  const adapter = getMatchingAdapter(request.identity);
  if (!adapter) {
    pendingRequest = request;
    return false;
  }

  invokeContinuation(request, adapter);
  return true;
};

export const registerLegacyRuntimeContinuation = (
  identity: PerpsRuntimeIdentity,
  handlers: LegacyRuntimeContinuationHandlers,
) => {
  adapterSequence += 1;
  const adapterId = adapterSequence;
  adapters.set(adapterId, { identity, handlers });
  tryFlushPendingRequest();

  return () => {
    adapters.delete(adapterId);
  };
};

export const resetLegacyRuntimeContinuationForTests = () => {
  adapterSequence = 0;
  activeGeneration = null;
  activeIdentity = null;
  activeOrigin = null;
  pendingRequest = null;
  claimedGenerations.clear();
  adapters.clear();
};
