import {
  prepareLegacyRuntimeContinuation,
  registerLegacyRuntimeContinuation,
  requestLegacyRuntimeContinuation,
  resetLegacyRuntimeContinuationForTests,
} from './legacyRuntimeContinuation';

describe('legacyRuntimeContinuation', () => {
  beforeEach(() => {
    resetLegacyRuntimeContinuationForTests();
  });

  it('claims a runtime generation at most once', () => {
    const selfSign = jest.fn();
    registerLegacyRuntimeContinuation('account-a', {
      selfSign,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });
    prepareLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      origin: 'runtime',
    });

    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'selfSign',
    });
    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'selfSign',
    });

    expect(selfSign).toHaveBeenCalledTimes(1);
  });

  it('lets only one of two focused adapters claim the generation', () => {
    const first = jest.fn();
    const second = jest.fn();
    registerLegacyRuntimeContinuation('account-a', {
      selfSign: first,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });
    registerLegacyRuntimeContinuation('account-a', {
      selfSign: second,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });
    prepareLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      origin: 'runtime',
    });

    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'selfSign',
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('keeps a request pending with no focused adapter and flushes on registration', () => {
    prepareLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      origin: 'runtime',
    });
    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'lockedAgent',
      agentAddress: 'agent-a',
    });

    const lockedAgent = jest.fn();
    registerLegacyRuntimeContinuation('account-a', {
      selfSign: () => undefined,
      lockedAgent,
      unlockedAgent: () => undefined,
    });

    expect(lockedAgent).toHaveBeenCalledTimes(1);
    expect(lockedAgent).toHaveBeenCalledWith('agent-a');
  });

  it('does not use an adapter after it unregisters on blur', () => {
    const selfSign = jest.fn();
    const unregister = registerLegacyRuntimeContinuation('account-a', {
      selfSign,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });
    unregister();
    prepareLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      origin: 'runtime',
    });

    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'selfSign',
    });

    expect(selfSign).not.toHaveBeenCalled();
  });

  it('ignores continuation requests for external-ready generations', () => {
    const selfSign = jest.fn();
    registerLegacyRuntimeContinuation('account-a', {
      selfSign,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });
    prepareLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      origin: 'external',
    });

    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'selfSign',
    });

    expect(selfSign).not.toHaveBeenCalled();
  });

  it('drops an old pending request when a new generation starts', () => {
    prepareLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      origin: 'runtime',
    });
    requestLegacyRuntimeContinuation({
      generation: 1,
      identity: 'account-a',
      branch: 'selfSign',
    });
    prepareLegacyRuntimeContinuation({
      generation: 2,
      identity: 'account-b',
      origin: 'runtime',
    });

    const accountA = jest.fn();
    registerLegacyRuntimeContinuation('account-a', {
      selfSign: accountA,
      lockedAgent: () => undefined,
      unlockedAgent: () => undefined,
    });

    expect(accountA).not.toHaveBeenCalled();
  });
});
