import type { Account } from '@/core/startupServices/preference';

import {
  prepareLegacyRuntimeContinuation,
  requestLegacyRuntimeContinuation,
  resetLegacyRuntimeContinuationForTests,
} from './legacyRuntimeContinuation';
import {
  adoptExternalPerpsRuntime,
  beginPerpsRuntimeGeneration,
  getPerpsRuntimeIdentity,
  getPerpsRuntimeSnapshot,
  isPerpsRuntimeGenerationCurrent,
  resetPerpsRuntimeStateForTests,
  setPerpsRuntimeError,
  setPerpsRuntimePhase,
  setPerpsRuntimeReady,
  setPerpsRuntimeWaitingForAccount,
  type PerpsRuntimeBranch,
  type PerpsRuntimeIdentity,
  type PerpsRuntimePhase,
} from './perpsRuntimeState';

type RuntimeBranch = Exclude<PerpsRuntimeBranch, null>;
type RuntimePhase = Exclude<PerpsRuntimePhase, null>;

type PerpsAgentWallet = {
  vault?: string;
  agentAddress: string;
};

export type PerpsRuntimeAccountContext = Readonly<{
  account: Account | null;
  generation: number;
  isInitialized: boolean;
}>;

export type PerpsRuntimeDependencies = {
  getPerpsAccountRuntimeContext: () => PerpsRuntimeAccountContext;
  isSelfSignPerpsAccount: (accountType?: string) => boolean;
  isWalletUnlocked: () => boolean;
  applyPerpsSigner: (account: Account) => Promise<unknown>;
  getPerpsAgentAddress: (masterAddress: string) => Promise<string | undefined>;
  getOrCreatePerpsAgentWallet: (
    masterAddress: string,
  ) => Promise<PerpsAgentWallet>;
  initPerpsAgentAccount: (
    masterAddress: string,
    vault: string | undefined,
    agentAddress: string,
  ) => void;
  loginPerpsAccount: (account: Account) => Promise<void>;
  fetchMarketData: () => Promise<unknown>;
  waitForInitialWsData: () => Promise<void>;
  setInitialized: (initialized: boolean) => void;
};

export type EnsurePerpsRuntimeOptions = {
  account: Account | null;
  isInitialized: boolean;
  dependencies: PerpsRuntimeDependencies;
};

type InFlightRuntime = {
  identity: PerpsRuntimeIdentity;
  generation: number;
  accountContextGeneration: number;
  promise: Promise<void>;
};

type LastRuntimeRequest = {
  account: Account;
  accountContextGeneration: number;
  dependencies: PerpsRuntimeDependencies;
};

const STALE_RUNTIME_GENERATION = Symbol('STALE_RUNTIME_GENERATION');

let inFlightRuntime: InFlightRuntime | null = null;
let lastRuntimeRequest: LastRuntimeRequest | null = null;
let signerQueue: Promise<void> = Promise.resolve();

const resolveRuntimeBranch = (
  account: Account,
  dependencies: PerpsRuntimeDependencies,
): RuntimeBranch => {
  if (dependencies.isSelfSignPerpsAccount(account.type)) {
    return 'selfSign';
  }
  return dependencies.isWalletUnlocked() ? 'unlockedAgent' : 'lockedAgent';
};

const runInSignerCriticalSection = <T>(task: () => Promise<T>): Promise<T> => {
  const result = signerQueue.then(task, task);
  signerQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const isCurrentExecutionContext = (
  generation: number,
  identity: PerpsRuntimeIdentity,
  accountContextGeneration: number,
  dependencies: PerpsRuntimeDependencies,
  requireUninitialized: boolean,
) => {
  if (!isPerpsRuntimeGenerationCurrent(generation, identity)) {
    return false;
  }

  const accountContext = dependencies.getPerpsAccountRuntimeContext();
  return (
    accountContext.generation === accountContextGeneration &&
    !!accountContext.account &&
    getPerpsRuntimeIdentity(accountContext.account) === identity &&
    (!requireUninitialized || !accountContext.isInitialized)
  );
};

const assertCurrentExecutionContext = (
  generation: number,
  identity: PerpsRuntimeIdentity,
  accountContextGeneration: number,
  dependencies: PerpsRuntimeDependencies,
  requireUninitialized = true,
) => {
  if (
    !isCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
      requireUninitialized,
    )
  ) {
    throw STALE_RUNTIME_GENERATION;
  }
};

const moveToPhase = (
  generation: number,
  identity: PerpsRuntimeIdentity,
  accountContextGeneration: number,
  dependencies: PerpsRuntimeDependencies,
  phase: RuntimePhase,
) => {
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
  setPerpsRuntimePhase(generation, identity, phase);
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
};

const runBaseline = async (
  dependencies: PerpsRuntimeDependencies,
  generation: number,
  identity: PerpsRuntimeIdentity,
  accountContextGeneration: number,
) => {
  moveToPhase(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
    'baseline',
  );
  await Promise.all([
    dependencies.fetchMarketData(),
    dependencies.waitForInitialWsData(),
  ]);
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
};

const runSelfSignRuntime = async ({
  account,
  dependencies,
  generation,
  identity,
  accountContextGeneration,
}: {
  account: Account;
  dependencies: PerpsRuntimeDependencies;
  generation: number;
  identity: PerpsRuntimeIdentity;
  accountContextGeneration: number;
}) => {
  await runInSignerCriticalSection(async () => {
    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
    );
    await dependencies.applyPerpsSigner(account);
    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
    );
  });

  moveToPhase(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
    'login',
  );
  await dependencies.loginPerpsAccount(account);
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );

  await runBaseline(
    dependencies,
    generation,
    identity,
    accountContextGeneration,
  );
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
  requestLegacyRuntimeContinuation({
    generation,
    identity,
    branch: 'selfSign',
  });
};

const runLockedAgentRuntime = async ({
  account,
  dependencies,
  generation,
  identity,
  accountContextGeneration,
}: {
  account: Account;
  dependencies: PerpsRuntimeDependencies;
  generation: number;
  identity: PerpsRuntimeIdentity;
  accountContextGeneration: number;
}) => {
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
  const agentAddress = await dependencies.getPerpsAgentAddress(account.address);
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );

  moveToPhase(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
    'login',
  );
  await dependencies.loginPerpsAccount(account);
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );

  await runBaseline(
    dependencies,
    generation,
    identity,
    accountContextGeneration,
  );
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
  requestLegacyRuntimeContinuation({
    generation,
    identity,
    branch: 'lockedAgent',
    agentAddress: agentAddress ?? '',
  });
};

const runUnlockedAgentRuntime = async ({
  account,
  dependencies,
  generation,
  identity,
  accountContextGeneration,
}: {
  account: Account;
  dependencies: PerpsRuntimeDependencies;
  generation: number;
  identity: PerpsRuntimeIdentity;
  accountContextGeneration: number;
}) => {
  const agentAddress = await runInSignerCriticalSection(async () => {
    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
    );
    const wallet = await dependencies.getOrCreatePerpsAgentWallet(
      account.address,
    );
    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
    );
    dependencies.initPerpsAgentAccount(
      account.address,
      wallet.vault,
      wallet.agentAddress,
    );
    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
    );
    return wallet.agentAddress;
  });

  moveToPhase(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
    'login',
  );
  await dependencies.loginPerpsAccount(account);
  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );

  assertCurrentExecutionContext(
    generation,
    identity,
    accountContextGeneration,
    dependencies,
  );
  requestLegacyRuntimeContinuation({
    generation,
    identity,
    branch: 'unlockedAgent',
    agentAddress,
  });
  await runBaseline(
    dependencies,
    generation,
    identity,
    accountContextGeneration,
  );
};

const runRuntimeGeneration = async ({
  account,
  branch,
  dependencies,
  generation,
  identity,
  accountContextGeneration,
}: {
  account: Account;
  branch: RuntimeBranch;
  dependencies: PerpsRuntimeDependencies;
  generation: number;
  identity: PerpsRuntimeIdentity;
  accountContextGeneration: number;
}) => {
  let phase: RuntimePhase = 'signer';

  try {
    if (branch === 'selfSign') {
      await runSelfSignRuntime({
        account,
        dependencies,
        generation,
        identity,
        accountContextGeneration,
      });
    } else if (branch === 'lockedAgent') {
      await runLockedAgentRuntime({
        account,
        dependencies,
        generation,
        identity,
        accountContextGeneration,
      });
    } else {
      await runUnlockedAgentRuntime({
        account,
        dependencies,
        generation,
        identity,
        accountContextGeneration,
      });
    }

    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
    );
    dependencies.setInitialized(true);
    assertCurrentExecutionContext(
      generation,
      identity,
      accountContextGeneration,
      dependencies,
      false,
    );
    setPerpsRuntimeReady(generation, identity);
  } catch (error) {
    if (error === STALE_RUNTIME_GENERATION) {
      return;
    }

    const currentSnapshot = getPerpsRuntimeSnapshot();
    if (
      currentSnapshot.generation === generation &&
      currentSnapshot.identity === identity &&
      isCurrentExecutionContext(
        generation,
        identity,
        accountContextGeneration,
        dependencies,
        true,
      )
    ) {
      phase = currentSnapshot.phase ?? phase;
      setPerpsRuntimeError(generation, identity, phase, error);
    }
  }
};

const startRuntimeGeneration = (
  account: Account,
  accountContextGeneration: number,
  dependencies: PerpsRuntimeDependencies,
) => {
  const identity = getPerpsRuntimeIdentity(account);
  const branch = resolveRuntimeBranch(account, dependencies);
  const generation = beginPerpsRuntimeGeneration(identity, branch);
  prepareLegacyRuntimeContinuation({
    generation,
    identity,
    origin: 'runtime',
  });

  const promise = runRuntimeGeneration({
    account,
    branch,
    dependencies,
    generation,
    identity,
    accountContextGeneration,
  }).finally(() => {
    if (
      inFlightRuntime?.generation === generation &&
      inFlightRuntime.identity === identity &&
      inFlightRuntime.accountContextGeneration === accountContextGeneration
    ) {
      inFlightRuntime = null;
    }
  });

  inFlightRuntime = {
    identity,
    generation,
    accountContextGeneration,
    promise,
  };
  return promise;
};

export const ensurePerpsRuntime = ({
  account,
  dependencies,
}: EnsurePerpsRuntimeOptions): Promise<void> => {
  const accountContext = dependencies.getPerpsAccountRuntimeContext();

  if (!account) {
    // A passive React effect may still carry `null` after the Store has
    // synchronously switched to an account. That stale effect must not
    // invalidate the new account's Runtime generation.
    if (accountContext.account) {
      return Promise.resolve();
    }

    const generation = setPerpsRuntimeWaitingForAccount();
    prepareLegacyRuntimeContinuation({
      generation,
      identity: null,
      origin: null,
    });
    inFlightRuntime = null;
    lastRuntimeRequest = null;
    return Promise.resolve();
  }

  const identity = getPerpsRuntimeIdentity(account);
  if (
    !accountContext.account ||
    getPerpsRuntimeIdentity(accountContext.account) !== identity
  ) {
    return Promise.resolve();
  }

  const accountContextGeneration = accountContext.generation;
  lastRuntimeRequest = {
    account,
    accountContextGeneration,
    dependencies,
  };

  if (
    inFlightRuntime?.identity === identity &&
    inFlightRuntime.accountContextGeneration === accountContextGeneration &&
    isCurrentExecutionContext(
      inFlightRuntime.generation,
      inFlightRuntime.identity,
      accountContextGeneration,
      dependencies,
      true,
    )
  ) {
    return inFlightRuntime.promise;
  }

  const currentSnapshot = getPerpsRuntimeSnapshot();
  // The Store read is authoritative. The Hook's render snapshot can lag a
  // synchronous account switch/reset until its passive effect runs.
  if (accountContext.isInitialized) {
    if (
      currentSnapshot.status === 'ready' &&
      currentSnapshot.identity === identity
    ) {
      return Promise.resolve();
    }

    const generation = adoptExternalPerpsRuntime(identity);
    prepareLegacyRuntimeContinuation({
      generation,
      identity,
      origin: 'external',
    });
    inFlightRuntime = null;
    return Promise.resolve();
  }

  return startRuntimeGeneration(
    account,
    accountContextGeneration,
    dependencies,
  );
};

export const retryPerpsRuntime = (): Promise<void> => {
  const request = lastRuntimeRequest;
  const currentSnapshot = getPerpsRuntimeSnapshot();
  if (
    !request ||
    currentSnapshot.status !== 'error' ||
    currentSnapshot.identity !== getPerpsRuntimeIdentity(request.account)
  ) {
    return Promise.resolve();
  }

  const accountContext = request.dependencies.getPerpsAccountRuntimeContext();
  if (
    accountContext.generation !== request.accountContextGeneration ||
    !accountContext.account ||
    getPerpsRuntimeIdentity(accountContext.account) !==
      getPerpsRuntimeIdentity(request.account) ||
    accountContext.isInitialized
  ) {
    return Promise.resolve();
  }

  return startRuntimeGeneration(
    request.account,
    request.accountContextGeneration,
    request.dependencies,
  );
};

export const resetPerpsRuntimeForTests = () => {
  inFlightRuntime = null;
  lastRuntimeRequest = null;
  signerQueue = Promise.resolve();
  resetLegacyRuntimeContinuationForTests();
  resetPerpsRuntimeStateForTests();
};
