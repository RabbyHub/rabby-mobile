const mockTraceAndroidInstant = jest.fn();
const mockMarkStartupRuntimePhase = jest.fn();

jest.mock('./androidTrace', () => ({
  traceAndroidInstant: (...args: unknown[]) => mockTraceAndroidInstant(...args),
}));

jest.mock('@/startup/runtimeDiagnostics', () => ({
  markStartupRuntimePhase: (...args: unknown[]) =>
    mockMarkStartupRuntimePhase(...args),
}));

import {
  getHomeContentReady,
  getHomeEntryReady,
  markHomeContentReady,
  markHomeEntryReady,
  markHomeEntryReadyIfEligible,
  resetHomeStartupMilestonesForTests,
  runAfterHomeContentReady,
  runAfterHomeEntryReady,
} from './homeStartupMilestones';

describe('home startup milestones', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetHomeStartupMilestonesForTests();
    mockTraceAndroidInstant.mockClear();
    mockMarkStartupRuntimePhase.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('releases waiting and late home entry tasks exactly once', () => {
    const waiting = jest.fn();
    const late = jest.fn();

    runAfterHomeEntryReady(waiting);
    expect(getHomeEntryReady()).toBe(false);

    expect(markHomeEntryReady('bootstrap_session_ready')).toBe(true);
    expect(markHomeEntryReady('wallet_auth_unlocked')).toBe(false);
    runAfterHomeEntryReady(late);

    expect(waiting).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
    expect(getHomeEntryReady()).toBe(true);
    expect(mockMarkStartupRuntimePhase).toHaveBeenCalledWith(
      'home',
      'entry-ready',
      'bootstrap_session_ready',
    );
  });

  it('keeps content tasks pending until content settles', () => {
    const callback = jest.fn();
    runAfterHomeContentReady(callback);

    markHomeEntryReady('wallet_auth_unlocked');
    expect(callback).not.toHaveBeenCalled();

    markHomeContentReady('portfolio_content_settled');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(getHomeContentReady()).toBe(true);
  });

  it('releases Home entry tasks when the first account appears without a restart', () => {
    const persistedPositionTask = jest.fn();
    const homePositionTask = jest.fn();

    runAfterHomeEntryReady(persistedPositionTask);
    runAfterHomeEntryReady(homePositionTask);

    expect(
      markHomeEntryReadyIfEligible(
        {
          appUnlocked: true,
          isUnlockSessionValid: true,
          hasVisibleAccounts: false,
        },
        'initial_bootstrap_without_accounts',
      ),
    ).toBe(false);
    expect(persistedPositionTask).not.toHaveBeenCalled();
    expect(homePositionTask).not.toHaveBeenCalled();

    expect(
      markHomeEntryReadyIfEligible(
        {
          appUnlocked: true,
          isUnlockSessionValid: true,
          hasVisibleAccounts: true,
        },
        'account_added_in_current_process',
      ),
    ).toBe(true);
    expect(persistedPositionTask).toHaveBeenCalledTimes(1);
    expect(homePositionTask).toHaveBeenCalledTimes(1);
  });

  it('keeps Home entry locked until account and authentication are both ready', () => {
    expect(
      markHomeEntryReadyIfEligible(
        {
          appUnlocked: false,
          isUnlockSessionValid: false,
          hasVisibleAccounts: true,
        },
        'account_added_while_locked',
      ),
    ).toBe(false);

    expect(
      markHomeEntryReadyIfEligible(
        {
          appUnlocked: false,
          isUnlockSessionValid: true,
          hasVisibleAccounts: true,
        },
        'unlock_session_ready_after_account_added',
      ),
    ).toBe(true);
  });

  it('preserves the phase hierarchy when content settles first', () => {
    markHomeContentReady('portfolio_content_settled');

    expect(getHomeEntryReady()).toBe(true);
    expect(getHomeContentReady()).toBe(true);
    expect(mockMarkStartupRuntimePhase.mock.calls).toEqual([
      ['home', 'entry-ready', 'home_content_ready_implies_entry'],
      ['home', 'content-ready', 'portfolio_content_settled'],
    ]);
  });

  it('runs a content task registered after the milestone immediately', () => {
    const callback = jest.fn();
    markHomeContentReady('portfolio_content_settled');

    expect(() =>
      runAfterHomeContentReady(callback, { fallbackMs: 5000 }),
    ).not.toThrow();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('starts a content fallback only after Home entry is ready', () => {
    const callback = jest.fn();
    runAfterHomeContentReady(callback, { fallbackMs: 5000 });

    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();

    markHomeEntryReady('bootstrap_session_ready');
    jest.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(getHomeContentReady()).toBe(false);
  });
});
